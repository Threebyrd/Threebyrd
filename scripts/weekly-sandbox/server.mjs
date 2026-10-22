import {createTestEditAdapter} from '../../app/subscriptions/sandbox/test-paid-edits.mjs';
import {drainWeeklyEmails,queueUpcomingNotices} from '../../app/subscriptions/sandbox/email-outbox.mjs';
import {sendSandboxEmail,ORDER_EMAIL_FROM,ORDER_EMAIL_REPLY_TO} from '../../app/subscriptions/sandbox/email-delivery.mjs';
import { createTestPurchases } from '../../app/subscriptions/sandbox/stripe-purchase.mjs';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WeeklyStore,token } from '../../app/subscriptions/sandbox/store.mjs';
import { createPayments } from '../../app/subscriptions/sandbox/payments.mjs';
import { createSandboxService } from '../../app/subscriptions/sandbox/service.mjs';

export function sampleCalendar(){
 // Explicit sample calendar, never imported by production checkout.
 return [
  ['review-44',44,'2026-10-31','2026-10-30T15:00:00-04:00','open'],
  ['review-45',45,'2026-11-08','2026-11-06T15:00:00-05:00','open'],
  ['review-46',46,'2026-11-14','2026-11-13T15:00:00-05:00','open'],
  ['review-47',47,'2026-11-21','2026-11-20T15:00:00-05:00','open'],
  ['review-48',48,'2026-11-28','2026-11-27T15:00:00-05:00','closed'],
  ['review-49',49,'2026-12-05','2026-12-04T15:00:00-05:00','open'],
 ].map(([id,sequence,deliveryDate,cutoffAt,status])=>({id,sequence,deliveryDate,cutoffAt,chargeAt:cutoffAt,status,...(status==='closed'?{closureReason:'Sample Thanksgiving closure — no order or charge.'}:{})}));
}
export function startSandbox({port=3012,databasePath=resolve('.local-previews/weekly-stage2/sandbox.sqlite'),testKey,webhookSecret,checkAddress,clock,taxCode,emailToken}={}){
 if(process.env.NODE_ENV==='production'||process.env.WEEKLY_ENABLE_BILLING==='true')throw new Error('This local sandbox cannot run in production or enable billing.');
 const baseUrl=`http://localhost:${port}`;
 const payments=createPayments({testKey,webhookSecret,baseUrl});
 mkdirSync(dirname(databasePath),{recursive:true});
 const store=new WeeklyStore(databasePath,{clock,environment:payments.environment});
 const environment=store.sql.prepare('SELECT environment FROM weekly_plans LIMIT 1').get()?.environment;
 if(environment&&environment!==payments.environment)throw new Error('Use separate database files for mock and Stripe test environments.');
 if(!store.calendar().length)store.publish(sampleCalendar());
 const devKey=token();
 const validateAddress=checkAddress??(async address=>{
  // Mock zone, deliberately not a geographic eligibility claim.
  if(address.city.toLowerCase()!=='ithaca'||address.state!=='NY'||!/^14850(?:-\d{4})?$/.test(address.zipCode)||!/^\d+\s/.test(address.streetAddress))throw new Error('The sandbox accepts test street addresses in Ithaca, NY 14850.');
 });
 const firstPayments=testKey&&taxCode?createTestPurchases({testKey,webhookSecret,baseUrl,taxCode}):undefined;
 const send=emailToken?message=>sendSandboxEmail({accountId:'4be3efc46385a4a26f3f303384bd97aa',token:emailToken,message}):undefined;
 const service=createSandboxService({store,baseUrl,payments,firstPayments,paidEdits:testKey&&taxCode?createTestEditAdapter({testKey,taxCode}):undefined,sendLogin:send?({url})=>send({from:ORDER_EMAIL_FROM,reply_to:ORDER_EMAIL_REPLY_TO,to:['luc@threebyrd.com'],subject:'[SANDBOX TEST] Manage your ThreeByrd plan',text:`Open this single-use link within 15 minutes to sign in: ${url}\n\nThis local sandbox link works only on the computer running the preview. If you did not request it, ignore this email.`}):undefined,checkAddress:validateAddress,devKey,staticRoot:new URL('./',import.meta.url),assetRoot:new URL('../../public/',import.meta.url),siteRoot:pathToFileURL(resolve('.local-previews/weekly-stage2/site')+'/')});
 let draining=false;
 const mailTimer=send?setInterval(async()=>{if(draining)return;draining=true;try{queueUpcomingNotices(store);await drainWeeklyEmails(store,{send,baseUrl})}catch{/* Queue retained for operator review. */}finally{draining=false}},3000):null;
 mailTimer?.unref();
 const server=createServer(async(incoming,outgoing)=>{
  try{
   const chunks=[];let size=0;
   for await(const chunk of incoming){size+=chunk.length;if(size>32000){outgoing.writeHead(413);outgoing.end('Request too large');return}chunks.push(chunk)}
   const payload=Buffer.concat(chunks);const req=new Request(`http://${incoming.headers.host}${incoming.url}`,{method:incoming.method,headers:incoming.headers,...(['GET','HEAD'].includes(incoming.method)?{}:{body:payload})});
   const res=await service.fetch(req);outgoing.writeHead(res.status,Object.fromEntries(res.headers.entries()));outgoing.end(Buffer.from(await res.arrayBuffer()));
  }catch{outgoing.writeHead(500,{'content-type':'application/json'});outgoing.end('{"error":"Local sandbox request failed."}')}
 });
 server.once('close',()=>{if(mailTimer)clearInterval(mailTimer)});
 // Bind only loopback; no staging/public exposure or reverse-proxy trust.
 server.listen(port,'127.0.0.1');
 // Retire the old Stage 1 preview link so it cannot show a different design.
 if(port===3012){
  const legacy=createServer((_request,response)=>{response.writeHead(302,{location:baseUrl+'/?review=welcome-v3','cache-control':'no-store'});response.end()});
  legacy.on('error',()=>{});legacy.listen(3011,'127.0.0.1');server.once('close',()=>legacy.close());
 }
 return {server,store,service,baseUrl,inboxUrl:`${baseUrl}/dev#${devKey}`};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const instance=startSandbox({port:Number(process.env.WEEKLY_SANDBOX_PORT??3012),databasePath:resolve(process.env.WEEKLY_SANDBOX_DB??'.local-previews/weekly-stage2/sandbox.sqlite'),taxCode:process.env.WEEKLY_STRIPE_TEST_TAX_CODE,testKey:process.env.WEEKLY_STRIPE_TEST_KEY,webhookSecret:process.env.WEEKLY_STRIPE_TEST_WEBHOOK_SECRET});
 instance.server.on('listening',()=>{console.log(`Customer sandbox: ${instance.baseUrl}`);console.log(`Private local test inbox: ${instance.inboxUrl}`);console.log('Recurring billing is OFF. No real emails. No production database or environment files are loaded.');});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>instance.server.close(()=>{instance.store.close();process.exit(0)}));
}
