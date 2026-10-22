import {websiteOrderChecks} from './order-checks.mjs';
import {applyReviewCalendar} from './calendar.mjs';
import {businessDateKey} from '../calendar.ts';
import Stripe from 'stripe';
import {createTestPurchases} from '../sandbox/stripe-purchase.mjs';
import {createTestEditAdapter} from '../sandbox/test-paid-edits.mjs';
import {createRecurringTestAdapter,prepareRecurringTest,processRecurringTest,reconcileRecurringTest} from '../sandbox/recurring-test.mjs';
import {sendVerifiedTestOrders} from '../sandbox/test-sheet-sync.mjs';
import {drainWeeklyEmails,queueUpcomingNotices} from '../sandbox/email-outbox.mjs';
import {DurableObject} from 'cloudflare:workers';
import {WeeklyStore} from '../sandbox/store-core.mjs';
import {createSandboxService} from '../sandbox/service.mjs';
import {createPayments} from '../sandbox/payments.mjs';
import {durableSqlAdapter} from './sql-storage.mjs';
import schema from '../sandbox/schema.sql';
const ORIGIN='https://threebyrd-weekly-staging.thorbwag.workers.dev';
export class WeeklyReview extends DurableObject{
 constructor(ctx,env){
  super(ctx,env);this.env=env;
  const database=durableSqlAdapter(ctx.storage);
  // PRAGMA foreign_keys is managed by the platform; schema is additive and isolated.
  database.exec(schema.replace('PRAGMA foreign_keys = ON;',''));
  this.stripeEnabled=env.REVIEW_STRIPE_TEST==='true';
  if(this.stripeEnabled&&!/^sk_test_/.test(env.WEEKLY_STRIPE_TEST_KEY??''))throw new Error('Stripe test key required.');
  const stripe=this.stripeEnabled?new Stripe(env.WEEKLY_STRIPE_TEST_KEY,{httpClient:Stripe.createFetchHttpClient()}):undefined;
  this.stripe=stripe;
  const orderChecks=websiteOrderChecks();
  this.recurring=stripe?createRecurringTestAdapter({testKey:env.WEEKLY_STRIPE_TEST_KEY,taxCode:'txcd_40060003',stripeClient:stripe}):undefined;
  if(this.recurring){const create=this.recurring.create;this.recurring.create=async snapshot=>{await orderChecks.preflight(snapshot);return create(snapshot);};}
  const firstPayments=stripe?createTestPurchases({testKey:env.WEEKLY_STRIPE_TEST_KEY,webhookSecret:env.WEEKLY_STRIPE_TEST_WEBHOOK_SECRET,baseUrl:ORIGIN,taxCode:'txcd_40060003',stripeClient:stripe}):undefined;
  if(firstPayments){const checkout=firstPayments.checkout;firstPayments.checkout=async snapshot=>{await orderChecks.preflight(snapshot);return checkout(snapshot);};}
  this.store=new WeeklyStore(database,{environment:stripe?'stripe_test':'mock'});
  applyReviewCalendar(this.store);
  const store=this.store;
  this.service=createSandboxService({store,baseUrl:ORIGIN,hostedOrigin:ORIGIN,allowedEmail:'luc@threebyrd.com',operatorEmail:'luc@threebyrd.com',requestBackgroundCheck:()=>this.ctx.storage.setAlarm(Date.now()+1000),recoveryAdapter:this.recurring,payments:createPayments({baseUrl:ORIGIN,...(stripe?{testKey:env.WEEKLY_STRIPE_TEST_KEY,webhookSecret:env.WEEKLY_STRIPE_TEST_WEBHOOK_SECRET,stripeClient:stripe}:{})}),
   firstPayments,
   paidEdits:stripe?createTestEditAdapter({testKey:env.WEEKLY_STRIPE_TEST_KEY,taxCode:'txcd_40060003',stripeClient:stripe}):undefined,devKey:env.REVIEW_OPERATOR_KEY,
   sendLogin:({url})=>this.sendEmail({to:['luc@threebyrd.com'],subject:'[STAGING TEST] Manage your ThreeByrd plan',text:`Open this single-use link within 15 minutes: ${url}\n\nThis is a hosted test plan. No live payment or real delivery.`}),
   checkAddress:a=>orderChecks.address(a),
   assetFetch:request=>this.assets(request),
  });
 }
 async assets(request){
  const url=new URL(request.url);
  if(['/weekly-plan','/weekly-plan/'].includes(url.pathname))return Response.redirect(ORIGIN+'/?plan=weekly#order',302);
  const appPaths=['/my-plan','/weekly-signup','/verify','/dev','/operations','/terms-draft','/privacy-draft','/one-time-preview'];
  if(appPaths.includes(url.pathname)||url.pathname.startsWith('/mock-card/'))url.pathname='/weekly-review/index.html';
  if(url.pathname==='/')url.pathname='/index.html';
  if(['/order','/success','/privacy','/terms'].includes(url.pathname))url.pathname+='.html';
  if(url.pathname==='/client.js')url.pathname='/weekly-review/client.js';
  if(url.pathname==='/style.css')url.pathname='/weekly-review/style.css';
  const response=await this.env.ASSETS.fetch(new Request(url,request));
  const headers=new Headers(response.headers);headers.set('cache-control','no-store');headers.set('referrer-policy','no-referrer');headers.set('x-content-type-options','nosniff');
  if(appPaths.includes(new URL(request.url).pathname)||new URL(request.url).pathname.startsWith('/mock-card/'))headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
  return new Response(response.body,{status:response.status,headers});
 }
 async sendEmail(message){
  if(message.to?.length!==1||message.to[0]!=='luc@threebyrd.com')throw new Error('Review recipient only.');
  return this.env.EMAIL.send({from:{email:'orders@threebyrd.com',name:'ThreeByrd Meal Prep'},replyTo:'luc@threebyrd.com',to:'luc@threebyrd.com',subject:message.subject,text:message.text});
 }
 async alarm(){
  const run=async(task,work)=>{
   let status='ok';try{await work()}catch{status='error'}
   this.store.sql.prepare('INSERT INTO weekly_runtime_status VALUES(?,?,?) ON CONFLICT(task) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at').run(task,status,Date.now());
  };
  await run('scheduled_test_billing',async()=>{
   if(this.stripeEnabled&&this.env.REVIEW_RECURRING_ENABLED==='true'){
    for(const cycle of this.store.calendar()){
     if(Date.now()>=Date.parse(cycle.cutoffAt)&&businessDateKey(new Date())<cycle.deliveryDate){
      for(const id of prepareRecurringTest(this.store,cycle.id))await processRecurringTest(this.store,id,this.recurring);
     }
    }
   }
  });
  await run('staging_sheet_sync',async()=>{if(this.stripeEnabled&&this.env.SHEETS_TEST_CONFIG)await sendVerifiedTestOrders(this.store,JSON.parse(this.env.SHEETS_TEST_CONFIG));});
  await run('owner_test_email',async()=>{queueUpcomingNotices(this.store);await drainWeeklyEmails(this.store,{baseUrl:ORIGIN,send:m=>this.sendEmail(m)});});
  if(this.store.sql.prepare('SELECT 1 FROM weekly_plans LIMIT 1').get()){
   const now=Date.now(),existing=await this.ctx.storage.getAlarm();
   const deadlines=this.store.calendar().flatMap(c=>[Date.parse(c.cutoffAt),Date.parse(c.cutoffAt)-86400000]).filter(t=>t>now);
   // Preserve a nearer alarm requested while an external provider call awaited.
   await this.ctx.storage.setAlarm(Math.min(now+3600000,...deadlines,...(existing&&existing>now?[existing]:[])));
  }
 }
 async fetch(request){
  if(new URL(request.url).pathname==='/api/stripe-webhook'&&request.method==='POST'&&this.stripeEnabled){
   try{
    const event=await this.stripe.webhooks.constructEventAsync(await request.clone().text(),request.headers.get('stripe-signature'),this.env.WEEKLY_STRIPE_TEST_WEBHOOK_SECRET);
    if(event.livemode!==false)return new Response('Test events only',{status:400});
    if(event.type==='checkout.session.completed'){const result=await this.service.fetch(new Request(ORIGIN+(event.data.object.mode==='setup'?'/api/setup-webhook':'/api/purchase-webhook'),request));if(result.ok)await this.ctx.storage.setAlarm(Date.now()+1000);return result;}
    if(!['payment_intent.succeeded','payment_intent.payment_failed'].includes(event.type))return Response.json({ignored:true});
    if(this.store.sql.prepare('SELECT 1 FROM weekly_events WHERE id=?').get(event.id))return Response.json({duplicate:true});
    const job=this.store.sql.prepare('SELECT id FROM weekly_test_recurring WHERE payment_intent_id=?').get(event.data.object.id);
    if(!job)return Response.json({ignored:true});
    const result=await reconcileRecurringTest(this.store,job.id,this.recurring);
    this.store.sql.prepare('INSERT OR IGNORE INTO weekly_events VALUES(?,?,?)').run(event.id,Date.now(),'stripe_test');
    await this.ctx.storage.setAlarm(Date.now()+1000);return Response.json(result);
   }catch{return new Response('Invalid or unreconciled test event',{status:400});}
  }
  const response=await this.service.fetch(request);
  if(this.store.sql.prepare('SELECT 1 FROM weekly_plans LIMIT 1').get()){
   const alarm=await this.ctx.storage.getAlarm();
   const pending=this.store.sql.prepare("SELECT 1 FROM weekly_email_outbox WHERE status='pending' LIMIT 1").get();
   if(!alarm||(pending&&alarm>Date.now()+1000))await this.ctx.storage.setAlarm(Date.now()+1000);
  }
  return response;
 }
}
export default {async fetch(request,env){
 const url=new URL(request.url);if(url.origin!==ORIGIN)return new Response('Wrong staging host',{status:403});
 if(url.pathname==='/health')return Response.json({environment:'weekly_review',billingEnabled:false,testRecurringEnabled:env.REVIEW_RECURRING_ENABLED==='true',stripeMode:env.REVIEW_STRIPE_TEST==='true'?'test':'mock',customerEmailsEnabled:false,testEmailsRecipient:'luc@threebyrd.com',storage:'isolated_durable_object'});
 return env.WEEKLY_REVIEW.get(env.WEEKLY_REVIEW.idFromName(env.REVIEW_STRIPE_TEST==='true'?'stripe-review-v1':'review-v1')).fetch(request);
}};
