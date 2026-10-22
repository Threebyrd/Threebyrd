import test from 'node:test';import assert from 'node:assert/strict';
import {WeeklyStore,DISCLOSURE_VERSION} from '../app/subscriptions/sandbox/store.mjs';
import {sampleCalendar} from '../scripts/weekly-sandbox/server.mjs';
import {prepareRecurringTest,processRecurringTest,reconcileRecurringTest,createRecurringTestAdapter} from '../app/subscriptions/sandbox/recurring-test.mjs';
function fixture(){
 let now=Date.parse('2026-10-21T17:00:00Z');const store=new WeeklyStore(':memory:',{environment:'stripe_test',clock:()=>now});store.publish(sampleCalendar());const customer=store.verify(store.requestLink('test@example.test','test').token).customer;
 store.enroll(customer.id,{cart:[{productId:'big-chicken',quantity:3,sauceId:'bbq'}],welcome:{productId:'big-beef',sauceId:'bbq'},recipientName:'Test',authorized:true,disclosureVersion:DISCLOSURE_VERSION},{streetAddress:'123 State St',city:'Ithaca',state:'NY',zipCode:'14850'});
 const plan=store.row(customer.id);store.saveMapping(customer.id,'cus_test');
 store.sql.prepare("UPDATE weekly_plans SET readiness='staged_ready',payment_method_id='pm_test' WHERE customer_id=?").run(customer.id);
 store.sql.prepare("INSERT INTO weekly_test_purchases VALUES('first',?,?,?,'{}','cs_test_first','paid',?)").run(customer.id,plan.plan.id,'review-44',now);
 store.sql.prepare("INSERT INTO weekly_welcome_redemptions VALUES(?,'first','review-44','2026-10-21')").run(customer.id);
 now=Date.parse('2026-11-06T20:00:00Z');let creates=0,confirms=0;let intent;
 const adapter={create:async s=>{creates++;intent={id:'pi_test',livemode:false,status:'succeeded',customer:'cus_test',payment_method:'pm_test',metadata:{weekly_recurring_id:s.id,weekly_plan_id:s.planId,tax_calculation:'taxcalc_test'},currency:'usd',amount:3402,amount_received:3402};return {intentId:'pi_test',taxCents:252,totalCents:3402,taxCalculationId:'taxcalc_test'}},confirm:async()=>{confirms++},retrieve:async()=>intent,recordTax:async()=> 'tax_test'};
 return {store,customer,adapter,setTime:t=>now=Date.parse(t),counts:()=>({creates,confirms}),tamper:()=>intent.amount=1};
}
test('recurring cutoff freezes one snapshot, reconciles saved-card payment and queues one fulfillment order',async()=>{
 const f=fixture();try{const [id]=prepareRecurringTest(f.store,'review-45');assert.ok(id);assert.deepEqual(prepareRecurringTest(f.store,'review-45'),[id]);assert.ok(f.store.locks(f.customer.id).includes('review-45'));
 assert.equal((await processRecurringTest(f.store,id,f.adapter)).status,'paid');assert.equal((await processRecurringTest(f.store,id,f.adapter)).status,'paid');assert.equal((await reconcileRecurringTest(f.store,id,f.adapter)).duplicate,true);
 assert.deepEqual(f.counts(),{creates:1,confirms:1});const order=JSON.parse(f.store.sql.prepare('SELECT snapshot FROM weekly_committed_orders').get().snapshot);assert.equal(order.quote.freeMealCount,0);assert.equal(order.totalCents,3402);assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_test_exports').get().n,1);
 }finally{f.store.close()}
});
test('unknown payment outcome never retries creation automatically or exports unpaid work',async()=>{
 const f=fixture();try{const [id]=prepareRecurringTest(f.store,'review-45');f.adapter.confirm=async()=>{throw new Error('network timeout')};assert.equal((await processRecurringTest(f.store,id,f.adapter)).status,'review_required');await processRecurringTest(f.store,id,f.adapter);assert.equal(f.counts().creates,1);assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_test_exports').get().n,0);
 assert.equal((await reconcileRecurringTest(f.store,id,f.adapter)).status,'paid');
 }finally{f.store.close()}
});
test('recurring runner refuses wrong mode, closed cycles, late mutations and post-delivery billing',()=>{
 const f=fixture();try{assert.deepEqual(prepareRecurringTest(f.store,'review-48'),[])}catch(e){assert.match(e.message,/billing window/)}finally{f.store.close()}
 const b=fixture();try{b.store.sql.prepare('INSERT INTO weekly_audit VALUES(?,?,?,?,?,?)').run('late',b.customer.id,'pause',2,b.store.clock()+1,'{}');assert.deepEqual(prepareRecurringTest(b.store,'review-45'),[]);b.setTime('2026-11-09T20:00:00Z');assert.throws(()=>prepareRecurringTest(b.store,'review-45'),/billing window/);assert.throws(()=>createRecurringTestAdapter({testKey:'sk_live_no',taxCode:'txcd_40060003'}));}finally{b.store.close()}
});
test('a declined recurring payment creates no kitchen order and cannot be automatically billed again',async()=>{
 const f=fixture();try{const [id]=prepareRecurringTest(f.store,'review-45');const original=f.adapter.retrieve;f.adapter.retrieve=async()=>({...await original(),status:'requires_payment_method',amount_received:0});assert.equal((await processRecurringTest(f.store,id,f.adapter)).status,'failed');assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_test_exports').get().n,0);assert.equal(f.store.sql.prepare("SELECT count(*) n FROM weekly_email_outbox WHERE kind='payment_failed'").get().n,1);await processRecurringTest(f.store,id,f.adapter);assert.equal(f.counts().creates,1);}finally{f.store.close()}
});

test('Stripe decline with cleared payment_method reconciles only the exact provider error method',async()=>{
 const f=fixture();try{const [id]=prepareRecurringTest(f.store,'review-45');const original=f.adapter.retrieve;f.adapter.retrieve=async()=>({...await original(),status:'requires_payment_method',payment_method:null,amount_received:0,last_payment_error:{payment_method:{id:'pm_test'}}});assert.equal((await processRecurringTest(f.store,id,f.adapter)).status,'failed');assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_test_exports').get().n,0);
 f.adapter.retrieve=async()=>({...await original(),status:'requires_payment_method',payment_method:null,amount_received:0,last_payment_error:{payment_method:{id:'pm_other'}}});await assert.rejects(reconcileRecurringTest(f.store,id,f.adapter),/mismatch/);
 }finally{f.store.close()}
});
