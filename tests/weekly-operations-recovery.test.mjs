import test from 'node:test';
import assert from 'node:assert/strict';
import {WeeklyStore,DISCLOSURE_VERSION} from '../app/subscriptions/sandbox/store.mjs';
import {createSandboxService} from '../app/subscriptions/sandbox/service.mjs';
import {createPayments} from '../app/subscriptions/sandbox/payments.mjs';
import {weeklyOperations} from '../app/subscriptions/sandbox/operations.mjs';
import {paymentIssues,skipUnpaidTestDelivery} from '../app/subscriptions/sandbox/payment-recovery.mjs';
import {applyReviewCalendar,fallReviewCalendar} from '../app/subscriptions/hosted/calendar.mjs';
import {websiteOrderChecks} from '../app/subscriptions/hosted/order-checks.mjs';
function fixture(){
 const store=new WeeklyStore(':memory:',{environment:'stripe_test',clock:()=>Date.parse('2026-10-21T18:00:00Z')});applyReviewCalendar(store);
 const customer=store.verify(store.requestLink('luc@threebyrd.com','test').token).customer;
 store.enroll(customer.id,{cart:[{productId:'big-chicken',quantity:3,sauceId:'no-sauce'}],welcome:{productId:'big-chicken',sauceId:'no-sauce'},recipientName:'Test',authorized:true,disclosureVersion:DISCLOSURE_VERSION},{streetAddress:'123 State St',city:'Ithaca',state:'NY',zipCode:'14850'});
 const snapshot={cycle:store.calendar()[0],stripeCustomerId:'cus_test'};
 store.sql.prepare("INSERT INTO weekly_test_recurring VALUES('job',?,?,?,'failed','pi_test',NULL,?)").run(customer.id,snapshot.cycle.id,JSON.stringify(snapshot),store.clock());
 return {store,customer,adapter:{cancelFailed:async()=>({id:'pi_test',livemode:false,customer:'cus_test',metadata:{weekly_recurring_id:'job'},status:'canceled'})}};
}
test('calendar fixes Friday 3 PM across DST and skips both Thanksgiving weekends without revision churn',()=>{
 const f=fixture();try{const first=f.store.sql.prepare('SELECT count(*) n FROM weekly_cycle_revisions').get().n;applyReviewCalendar(f.store);assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_cycle_revisions').get().n,first);
 assert.deepEqual(fallReviewCalendar().filter(c=>c.status==='closed').map(c=>c.deliveryDate),['2026-11-21','2026-11-28']);
 for(const c of f.store.calendar()){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'long',hour:'numeric',minute:'2-digit',hour12:false}).format(new Date(c.cutoffAt));assert.match(parts,/Friday/);assert.match(parts,/15:00/);assert.equal(c.chargeAt,c.cutoffAt)}
 }finally{f.store.close()}
});
test('recovery verifies cancellation, preserves failure audit, clears blocker and never creates fulfillment',async()=>{
 const f=fixture();try{assert.equal(paymentIssues(f.store,f.customer.id).length,1);await assert.rejects(skipUnpaidTestDelivery(f.store,f.adapter,'other','job'),/not found/);
 await assert.rejects(skipUnpaidTestDelivery(f.store,{cancelFailed:async()=>({status:'succeeded'})},f.customer.id,'job'),/safely closed/);
 assert.equal(weeklyOperations(f.store).summary.paymentIssues,1);
 assert.equal((await skipUnpaidTestDelivery(f.store,f.adapter,f.customer.id,'job')).skipped,true);assert.equal((await skipUnpaidTestDelivery(f.store,{cancelFailed:()=>{throw Error('duplicate')}},f.customer.id,'job')).duplicate,true);
 assert.equal(paymentIssues(f.store,f.customer.id).length,0);assert.equal(weeklyOperations(f.store).summary.paymentIssues,0);assert.equal(f.store.state(f.customer.id).preview.cycles[0].status,'skipped');assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_committed_orders').get().n,0);assert.equal(f.store.sql.prepare("SELECT status FROM weekly_test_recurring WHERE id='job'").get().status,'failed');
 }finally{f.store.close()}
});
test('operator endpoint denies anonymous, nonoperators, and disabled configuration',async()=>{
 const f=fixture();try{
 const verified=f.store.verify(f.store.requestLink('luc@threebyrd.com','another').token);
 const other=f.store.verify(f.store.requestLink('other@example.test','other').token);
 const baseUrl='http://localhost:3012';const service=createSandboxService({store:f.store,baseUrl,payments:createPayments({baseUrl}),checkAddress:async()=>{},operatorEmail:'luc@threebyrd.com'});
 const get=session=>service.fetch(new Request(baseUrl+'/api/operations',{headers:session?{cookie:'weekly_sandbox='+session.session}:{}}));
 assert.equal((await get()).status,401);assert.equal((await get(other)).status,403);const ok=await get(verified);assert.equal(ok.status,200);assert.equal((await ok.json()).subscribers.length,1);
 const disabled=createSandboxService({store:f.store,baseUrl,payments:createPayments({baseUrl}),checkAddress:async()=>{}});assert.equal((await disabled.fetch(new Request(baseUrl+'/api/operations',{headers:{cookie:'weekly_sandbox='+verified.session}}))).status,403);
 }finally{f.store.close()}
});
test('website checks reuse read-only endpoints and fail closed on cap activation or provider outage',async()=>{
 const seen=[];let capacity={enabled:false,limit:null,ordersOpen:true};
 const checks=websiteOrderChecks({fetchImpl:async(url,init)=>{seen.push([url,init.method]);return Response.json(url.endsWith('/api/capacity')?capacity:{eligible:true,driveMinutes:10})}});
 assert.equal((await checks.preflight({address:{}})).eligible,true);assert.deepEqual(seen.map(x=>x[0]),['https://api.threebyrd.com/api/delivery-eligibility','https://api.threebyrd.com/api/capacity']);
 capacity={enabled:true,limit:100,ordersOpen:true};await assert.rejects(checks.preflight({address:{}}),/Shared capacity/);
 capacity={enabled:false,limit:null,ordersOpen:false};await assert.rejects(checks.preflight({address:{}}),/closed/);
 await assert.rejects(websiteOrderChecks({fetchImpl:async()=>new Response('',{status:503})}).address({}),/unavailable/);
});
test('background-run request requires operator session, same origin and CSRF before scheduling',async()=>{
 const f=fixture();try{
  const owner=f.store.verify(f.store.requestLink('luc@threebyrd.com','owner-checks').token),other=f.store.verify(f.store.requestLink('other@example.test','other-checks').token);
  const baseUrl='http://localhost:3012';let calls=0;
  const service=createSandboxService({store:f.store,baseUrl,payments:createPayments({baseUrl}),checkAddress:async()=>{},operatorEmail:'luc@threebyrd.com',requestBackgroundCheck:async()=>{calls++}});
  const post=(session,origin=baseUrl,csrf=session?.csrf)=>service.fetch(new Request(baseUrl+'/api/operations/checks',{method:'POST',headers:{origin,...(session?{cookie:'weekly_sandbox='+session.session,'x-csrf-token':csrf}:{})}}));
  assert.equal((await post()).status,401);assert.equal((await post(other)).status,403);assert.equal((await post(owner,'https://other.example')).status,403);assert.equal((await post(owner,baseUrl,'wrong')).status,403);assert.equal(calls,0);assert.equal((await post(owner)).status,200);assert.equal(calls,1);
 }finally{f.store.close()}
});
