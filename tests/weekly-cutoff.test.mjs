import test from 'node:test';
import assert from 'node:assert/strict';
import { WeeklyStore, DISCLOSURE_VERSION } from '../app/subscriptions/sandbox/store.mjs';
import { runMockCutoff, resolveMockPayment, mockOperations } from '../app/subscriptions/sandbox/cutoff.mjs';
import { sampleCalendar } from '../scripts/weekly-sandbox/server.mjs';
function fixture(){
 let now=Date.parse('2026-10-21T17:00:00Z');
 const store=new WeeklyStore(':memory:',{clock:()=>now});store.publish(sampleCalendar());
 const customer=store.verify(store.requestLink('cutoff@example.test','test').token).customer;
 store.enroll(customer.id,{cart:[{productId:'big-chicken',quantity:3,sauceId:'bbq'}],welcome:{productId:'little-beef',sauceId:'bbq'},recipientName:'Test Person',authorized:true,disclosureVersion:DISCLOSURE_VERSION},{streetAddress:'123 State St',city:'Ithaca',state:'NY',zipCode:'14850'});
 const row=store.row(customer.id);store.startSetup(customer.id,'setup','customer',row.plan.id);
 store.completeSetup({eventId:'setup-event',setupId:'setup',stripeCustomerId:'customer',paymentMethodId:'mock-card',livemode:false,status:'succeeded'});
 const cycle=store.calendar().find(c=>c.status==='open'&&Date.parse(c.cutoffAt)>now);
 return {store,customer,cycle,time:v=>{now=Date.parse(v)}};
}
test('cutoff locks once, retains regular sauce charges, and exports only paid orders',()=>{
 const f=fixture();try{
  assert.throws(()=>runMockCutoff(f.store,f.cycle.id),/not arrived/);
  f.time(f.cycle.cutoffAt);const [result]=runMockCutoff(f.store,f.cycle.id);
  assert.equal(result.amount_cents,3150);assert.equal(result.status,'paid');
  runMockCutoff(f.store,f.cycle.id);
  const ops=mockOperations(f.store);assert.equal(ops.orders.length,1);assert.equal(ops.orders[0].quote.fulfillmentMealCount,4);assert.equal(ops.orders[0].firstWeekGift,true);
  assert.equal(f.store.ledger().length,1);
  assert.throws(()=>f.store.sql.prepare("UPDATE weekly_committed_orders SET snapshot='{}'").run(),/immutable/);
 }finally{f.store.close()}
});
test('failed and requires-action payments never export; recovery is idempotent',()=>{
 for(const outcome of ['failed','requires_action']){
 const f=fixture();try{
  f.time(f.cycle.cutoffAt);const [payment]=runMockCutoff(f.store,f.cycle.id,{outcomes:{[f.customer.id]:outcome}});
  assert.equal(mockOperations(f.store).orders.length,0);assert.equal(f.store.ledger().length,0);
  resolveMockPayment(f.store,payment.id,'paid');resolveMockPayment(f.store,payment.id,'paid');
  assert.equal(mockOperations(f.store).orders.length,1);assert.equal(f.store.ledger().length,1);
 }finally{f.store.close()}}
});
test('skipped, paused, canceled and closed deliveries create no payment',()=>{
 for(const action of ['skip','pause','cancel']){const f=fixture();try{
  f.store.mutate(f.customer.id,{action,version:f.store.row(f.customer.id).version,cycleId:f.cycle.id,resumeCycleId:null});
  f.time(f.cycle.cutoffAt);runMockCutoff(f.store,f.cycle.id);assert.equal(mockOperations(f.store).payments.length,0);
 }finally{f.store.close()}}
 const f=fixture();try{f.store.publish(f.store.calendar().map(c=>c.id===f.cycle.id?{...c,status:'closed',closureReason:'Holiday'}:c));f.time(f.cycle.cutoffAt);runMockCutoff(f.store,f.cycle.id);assert.equal(mockOperations(f.store).orders.length,0);}finally{f.store.close()}
});
test('late changed plans and delivery-day recovery require support instead of retrospective billing',()=>{
 const f=fixture();try{
  f.time(new Date(Date.parse(f.cycle.cutoffAt)+1000).toISOString());f.store.mutate(f.customer.id,{action:'cancel',version:f.store.row(f.customer.id).version});
  assert.equal(runMockCutoff(f.store,f.cycle.id)[0].status,'support_review_late_change');
  f.time(f.cycle.deliveryDate+'T17:00:00Z');assert.throws(()=>runMockCutoff(f.store,f.cycle.id),/Delivery has passed/);
 }finally{f.store.close()}
});

test('welcome gift is once per customer and later paid weeks keep the discount',()=>{
 const f=fixture();try{
  f.time(f.cycle.cutoffAt);runMockCutoff(f.store,f.cycle.id);
  const next=f.store.calendar().find(c=>c.sequence>f.cycle.sequence&&c.status==='open');
  f.time(next.cutoffAt);runMockCutoff(f.store,next.id);
  const orders=mockOperations(f.store).orders;
  assert.equal(orders.length,2);assert.deepEqual(orders.map(o=>o.quote.freeMealCount),[1,0]);
  assert.ok(orders.every(o=>o.quote.discountCents===150));
 }finally{f.store.close()}
});
test('unresolved payments block overlapping orders; abandonment releases the next gift',()=>{
 const f=fixture();try{
  f.time(f.cycle.cutoffAt);const [failed]=runMockCutoff(f.store,f.cycle.id,{outcomes:{[f.customer.id]:'failed'}});
  const next=f.store.calendar().find(c=>c.sequence>f.cycle.sequence&&c.status==='open');
  f.time(next.cutoffAt);assert.equal(runMockCutoff(f.store,next.id)[0].status,'blocked_prior_payment');
  assert.throws(()=>resolveMockPayment(f.store,failed.id,'paid'),/Delivery has passed/);
  resolveMockPayment(f.store,failed.id,'abandoned');runMockCutoff(f.store,next.id);
  assert.equal(mockOperations(f.store).orders.length,1);assert.equal(f.store.ledger().length,1);
  assert.throws(()=>resolveMockPayment(f.store,failed.id,'paid'),/Abandoned/);
 }finally{f.store.close()}
});

test('signup purchases a full-size gift immediately and cutoff never charges that cycle twice',async()=>{
 const {purchaseMockFirstDelivery}=await import('../app/subscriptions/sandbox/cutoff.mjs');
 const f=fixture();try{
  f.store.mutate(f.customer.id,{action:'welcome',welcome:{productId:'big-beef',sauceId:'bbq'},version:f.store.row(f.customer.id).version});
  purchaseMockFirstDelivery(f.store,f.customer.id);purchaseMockFirstDelivery(f.store,f.customer.id);
  assert.equal(mockOperations(f.store).orders.length,1);
  assert.equal(mockOperations(f.store).orders[0].quote.welcomeLine.productId,'big-beef');
  assert.notEqual(f.store.state(f.customer.id).preview.next.cycle.id,f.cycle.id);
  f.time(f.cycle.cutoffAt);runMockCutoff(f.store,f.cycle.id);
  assert.equal(mockOperations(f.store).orders.length,1);
 }finally{f.store.close()}
});

test('paid edits approve exact deltas, preserve original snapshots, and update one preparation row',async()=>{
 const {purchaseMockFirstDelivery}=await import('../app/subscriptions/sandbox/cutoff.mjs');
 const {previewPaidEdit,savePaidEdit}=await import('../app/subscriptions/sandbox/paid-edits.mjs');
 const f=fixture();try{
  purchaseMockFirstDelivery(f.store,f.customer.id);
  const order=mockOperations(f.store).orders[0];
  const body={orderId:order.orderId,cart:[{productId:'big-beef',quantity:4,sauceId:'bbq'}]};
  const proposal=previewPaidEdit(f.store,f.customer.id,body);assert.ok(proposal.deltaCents>0);
  const save={...body,revision:proposal.revision,approvedDeltaCents:proposal.deltaCents,requestId:'change_request_001',outcome:'paid'};
  assert.throws(()=>savePaidEdit(f.store,'other',save),/not found/);
  assert.throws(()=>savePaidEdit(f.store,f.customer.id,{...save,approvedDeltaCents:0}),/approve/);
  savePaidEdit(f.store,f.customer.id,save);assert.equal(savePaidEdit(f.store,f.customer.id,save).duplicate,true);
  assert.equal(mockOperations(f.store).orders.length,1);
  assert.equal(mockOperations(f.store).orders[0].quote.paidMealCount,4);
  assert.equal(JSON.parse(f.store.sql.prepare('SELECT snapshot FROM weekly_committed_orders').get().snapshot).quote.paidMealCount,3);
  const lower={orderId:order.orderId,cart:[{productId:'big-chicken',quantity:3,sauceId:'no-sauce'}]};
  const refund=previewPaidEdit(f.store,f.customer.id,lower);assert.ok(refund.deltaCents<0);
  savePaidEdit(f.store,f.customer.id,{...lower,revision:refund.revision,approvedDeltaCents:refund.deltaCents,requestId:'change_request_002',outcome:'failed'});
  assert.equal(mockOperations(f.store).orders[0].quote.paidMealCount,4);
  const retry=previewPaidEdit(f.store,f.customer.id,lower);
  savePaidEdit(f.store,f.customer.id,{...lower,revision:retry.revision,approvedDeltaCents:retry.deltaCents,requestId:'change_request_003',outcome:'paid'});
  assert.equal(mockOperations(f.store).orders[0].quote.paidMealCount,3);
  assert.equal(f.store.ledger().length,1);
  f.time(f.cycle.cutoffAt);assert.throws(()=>previewPaidEdit(f.store,f.customer.id,lower),/cutoff/);
 }finally{f.store.close()}
});
