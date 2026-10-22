import Stripe from 'stripe';
import {DurableObject} from 'cloudflare:workers';
import {WeeklyStore} from '../sandbox/store-core.mjs';
import {createSandboxService} from '../sandbox/service.mjs';
import {createLivePayments} from '../sandbox/payments.mjs';
import {createLivePurchases} from '../sandbox/stripe-purchase.mjs';
import {createLiveEditAdapter} from '../sandbox/test-paid-edits.mjs';
import {createRecurringLiveAdapter,prepareRecurringTest,processRecurringTest,reconcileRecurringTest} from '../sandbox/recurring-test.mjs';
import {sendVerifiedLiveOrders} from '../sandbox/test-sheet-sync.mjs';
import {drainWeeklyEmails,queueUpcomingNotices} from '../sandbox/email-outbox.mjs';
import {businessDateKey} from '../calendar.ts';
import {durableSqlAdapter} from '../hosted/sql-storage.mjs';
import {websiteOrderChecks} from '../hosted/order-checks.mjs';
import {fallReviewCalendar} from '../hosted/calendar.mjs';
import {LIVE_AUTHORIZATION} from './authorization.mjs';
import {productionSchema} from './schema.mjs';
import schema from '../sandbox/schema.sql';
export const LIVE_ORIGIN='https://weekly.threebyrd.com';
export function productionStatus(env){return {environment:'production',billingEnabled:env.WEEKLY_BILLING_ENABLED==='true',customerEmailsEnabled:env.WEEKLY_CUSTOMER_EMAILS_ENABLED==='true',configured:/^sk_live_/.test(env.STRIPE_SECRET_KEY??'')&&/^whsec_/.test(env.WEEKLY_STRIPE_WEBHOOK_SECRET??'')&&!!env.WEEKLY_SHEETS_CONFIG}}
export class WeeklyProduction extends DurableObject{
 constructor(ctx,env){
  super(ctx,env);this.env=env;
  const sql=durableSqlAdapter(ctx.storage);sql.exec(productionSchema(schema).replace('PRAGMA foreign_keys = ON;',''));
  this.store=new WeeklyStore(sql,{environment:'stripe_live',authorization:LIVE_AUTHORIZATION});
  if(!this.store.calendar().length)this.store.publish(fallReviewCalendar().map(c=>({...c,id:c.id.replace('review-','fall-')})));
  this.enabled=()=>env.WEEKLY_BILLING_ENABLED==='true';
  if(!productionStatus(env).configured)return;
  const stripe=new Stripe(env.STRIPE_SECRET_KEY,{httpClient:Stripe.createFetchHttpClient()});this.stripe=stripe;
  const options={liveKey:env.STRIPE_SECRET_KEY,webhookSecret:env.WEEKLY_STRIPE_WEBHOOK_SECRET,baseUrl:LIVE_ORIGIN,taxCode:'txcd_40060003',stripeClient:stripe};
  const checks=websiteOrderChecks(),firstPayments=createLivePurchases(options),edits=createLiveEditAdapter(options),recurring=createRecurringLiveAdapter(options);
  const gate=()=>{if(!this.enabled())throw new Error('Weekly billing is paused.');};
  const checkout=firstPayments.checkout;firstPayments.checkout=async p=>{gate();await checks.preflight(p);gate();return checkout(p)};
  const create=recurring.create;recurring.create=async p=>{gate();await checks.preflight(p);gate();return create(p)};
  const confirm=recurring.confirm;recurring.confirm=(...args)=>{gate();return confirm(...args)};
  const apply=edits.apply;edits.apply=change=>{gate();return apply(change)};this.recurring=recurring;
  this.service=createSandboxService({store:this.store,baseUrl:LIVE_ORIGIN,productionOrigin:LIVE_ORIGIN,payments:createLivePayments(options),firstPayments,paidEdits:edits,recoveryAdapter:recurring,billingAllowed:this.enabled,checkAddress:a=>checks.address(a),operatorEmail:'luc@threebyrd.com',allowedEmail:env.WEEKLY_CUSTOMER_EMAILS_ENABLED==='true'?undefined:'luc@threebyrd.com',assetFetch:r=>this.assets(r),requestBackgroundCheck:()=>ctx.storage.setAlarm(Date.now()+1000),sendLogin:({email,url})=>this.sendEmail({to:[email],subject:'Manage your ThreeByrd weekly plan',text:`Open this single-use link within 15 minutes: ${url}\n\nIf you did not request it, ignore this email.\nThreeByrd Meal Prep\nluc@threebyrd.com`})});
 }
 async sendEmail(message){
  const to=message.to?.[0];if(message.to?.length!==1||!to||this.env.WEEKLY_CUSTOMER_EMAILS_ENABLED!=='true'&&to!=='luc@threebyrd.com')throw Error('Customer email delivery is paused.');
  return this.env.EMAIL.send({from:{email:'orders@threebyrd.com',name:'ThreeByrd Meal Prep'},replyTo:'luc@threebyrd.com',to,subject:message.subject,text:message.text});
 }
 async assets(request){
  const url=new URL(request.url);const pages=['/my-plan','/weekly-signup','/verify','/operations','/terms-draft','/privacy-draft'];
  if(url.pathname==='/'||url.pathname==='/weekly-plan')return Response.redirect('https://threebyrd.com/?plan=weekly#order',302);
  if(pages.includes(url.pathname))url.pathname='/weekly-review/index.html';
  if(url.pathname==='/client.js')url.pathname='/weekly-review/client.js';if(url.pathname==='/style.css')url.pathname='/weekly-review/style.css';
  const result=await this.env.ASSETS.fetch(new Request(url,request));const headers=new Headers(result.headers);
  headers.set('cache-control','no-store');headers.set('referrer-policy','no-referrer');headers.set('x-content-type-options','nosniff');
  if(pages.includes(new URL(request.url).pathname))headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
  return new Response(result.body,{status:result.status,headers});
 }
 async alarm(){
  if(!this.service)return;
  const run=async(task,work)=>{let status='ok';try{await work()}catch{status='error'}this.store.sql.prepare('INSERT INTO weekly_runtime_status VALUES(?,?,?) ON CONFLICT(task) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at').run(task,status,Date.now())};
  await run('weekly_billing',async()=>{if(this.enabled())for(const c of this.store.calendar())if(Date.now()>=Date.parse(c.cutoffAt)&&businessDateKey(new Date())<c.deliveryDate)for(const id of prepareRecurringTest(this.store,c.id))await processRecurringTest(this.store,id,this.recurring)});
  // In-flight paid events must still export even while billing is paused.
  await run('order_sheet_sync',()=>sendVerifiedLiveOrders(this.store,JSON.parse(this.env.WEEKLY_SHEETS_CONFIG)));
  await run('customer_email',async()=>{queueUpcomingNotices(this.store);await drainWeeklyEmails(this.store,{baseUrl:LIVE_ORIGIN,customerEmailsEnabled:this.env.WEEKLY_CUSTOMER_EMAILS_ENABLED==='true',send:m=>this.sendEmail(m)})});
  if(this.store.sql.prepare('SELECT 1 FROM weekly_plans LIMIT 1').get()){const now=Date.now(),existing=await this.ctx.storage.getAlarm(),times=this.store.calendar().flatMap(c=>[Date.parse(c.cutoffAt),Date.parse(c.cutoffAt)-86400000]).filter(t=>t>now);await this.ctx.storage.setAlarm(Math.min(now+3600000,...times,...(existing&&existing>now?[existing]:[])))}
 }
 async fetch(request){
  if(!this.service)return Response.json({error:'Weekly plans are being prepared. Signup and billing are disabled.'},{status:503});
  if(new URL(request.url).pathname==='/api/stripe-webhook'&&request.method==='POST'){
   try{
    const event=await this.stripe.webhooks.constructEventAsync(await request.clone().text(),request.headers.get('stripe-signature'),this.env.WEEKLY_STRIPE_WEBHOOK_SECRET);
    if(event.livemode!==true)return new Response('Live events only',{status:400});
    if(event.type==='checkout.session.completed'){const result=await this.service.fetch(new Request(LIVE_ORIGIN+(event.data.object.mode==='setup'?'/api/setup-webhook':'/api/purchase-webhook'),request));if(result.ok)await this.ctx.storage.setAlarm(Date.now()+1000);return result}
    if(!['payment_intent.succeeded','payment_intent.payment_failed'].includes(event.type))return Response.json({ignored:true});
    if(this.store.sql.prepare('SELECT 1 FROM weekly_events WHERE id=?').get(event.id))return Response.json({duplicate:true});
    const job=this.store.sql.prepare('SELECT id FROM weekly_test_recurring WHERE payment_intent_id=?').get(event.data.object.id);if(!job)return Response.json({ignored:true});
    const result=await reconcileRecurringTest(this.store,job.id,this.recurring);this.store.sql.prepare('INSERT OR IGNORE INTO weekly_events VALUES(?,?,?)').run(event.id,Date.now(),'stripe_live');await this.ctx.storage.setAlarm(Date.now()+1000);return Response.json(result);
   }catch{return new Response('Invalid or unreconciled live event',{status:400})}
  }
  if(new URL(request.url).pathname==='/api/catalog'&&request.method==='GET'){const result=await this.service.fetch(request);const headers=new Headers(result.headers);headers.set('access-control-allow-origin','https://threebyrd.com');headers.set('vary','Origin');return new Response(result.body,{status:result.status,headers})}
  const result=await this.service.fetch(request);
  if(this.store.sql.prepare('SELECT 1 FROM weekly_plans LIMIT 1').get()){const alarm=await this.ctx.storage.getAlarm();if(!alarm||this.store.sql.prepare("SELECT 1 FROM weekly_email_outbox WHERE status='pending' LIMIT 1").get()&&alarm>Date.now()+1000)await this.ctx.storage.setAlarm(Date.now()+1000)}
  return result;
 }
}
export default {fetch(request,env){
 const url=new URL(request.url);if(url.pathname==='/health')return Response.json(productionStatus(env));
 if(url.origin!==LIVE_ORIGIN)return new Response('Wrong production host',{status:403});
 return env.WEEKLY_PRODUCTION.get(env.WEEKLY_PRODUCTION.idFromName('production-v1')).fetch(request);
}};
