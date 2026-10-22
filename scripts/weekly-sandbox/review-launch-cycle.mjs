// Explicit operator exercise: real Stripe TEST calls with an advanced local clock.
// No public route, live funds, production order writes, or customer distribution.
import assert from 'node:assert/strict';
import {backup} from 'node:sqlite';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import Stripe from 'stripe';
import {WeeklyStore} from '../../app/subscriptions/sandbox/store.mjs';
import {fallReviewCalendar} from '../../app/subscriptions/hosted/calendar.mjs';
import {prepareRecurringTest,processRecurringTest,reconcileRecurringTest,createRecurringTestAdapter} from '../../app/subscriptions/sandbox/recurring-test.mjs';
import {skipUnpaidTestDelivery,paymentIssues} from '../../app/subscriptions/sandbox/payment-recovery.mjs';
import {sendVerifiedTestOrders} from '../../app/subscriptions/sandbox/test-sheet-sync.mjs';
const root='.local-previews/weekly-stage3/',path=root+'launch-cycle-review.sqlite',reportPath=root+'launch-cycle-report.json';
const key=readFileSync(root+'stripe-test-key','utf8').trim();if(!/^sk_test_/.test(key))throw new Error('Only Stripe TEST is supported.');
if(!existsSync(path)){const source=new WeeklyStore(root+'stripe-test.sqlite',{environment:'stripe_test'});try{await backup(source.sql,path)}finally{source.close()}}
let now=Date.parse('2026-10-22T16:00:00Z');
const store=new WeeklyStore(path,{environment:'stripe_test',clock:()=>now}),stripe=new Stripe(key);
store.sql.exec('CREATE TABLE IF NOT EXISTS launch_exercise_results (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
async function once(id,work){const saved=store.sql.prepare('SELECT data FROM launch_exercise_results WHERE id=?').get(id);if(saved)return JSON.parse(saved.data);const result=await work();store.sql.prepare('INSERT INTO launch_exercise_results VALUES(?,?)').run(id,JSON.stringify(result));return result}
try{
 const first=store.sql.prepare("SELECT customer_id FROM weekly_test_purchases WHERE status='paid' LIMIT 1").get();if(!first)throw Error('Verified first test purchase required.');
 const customerId=first.customer_id,customer=store.mapping(customerId);
 await once('isolated-plan-identity',async()=>{const current=store.row(customerId);const id=current.plan.id+':launch-review';store.sql.prepare('UPDATE weekly_plans SET plan_id=?,data=? WHERE customer_id=?').run(id,JSON.stringify({...current.plan,id}),customerId);store.sql.prepare("UPDATE weekly_test_purchases SET plan_id=? WHERE customer_id=? AND status='paid'").run(id,customerId);return {copiedPlanId:id}});
 const plan=store.row(customerId);
 const originalCard=await once('original-card',async()=>{const source=new WeeklyStore(root+'stripe-test.sqlite',{environment:'stripe_test'});try{return {methodId:source.row(customerId).payment_method_id}}finally{source.close()}});
 const originalMethod=originalCard.methodId;
 const remote=await stripe.customers.retrieve(customer);if(remote.deleted||remote.livemode!==false)throw Error('Test ownership required.');
 await once('calendar',async()=>{const calendar=fallReviewCalendar();store.publish(calendar);return {published:true}});
 const adapter=createRecurringTestAdapter({testKey:key,taxCode:'txcd_40060003',stripeClient:stripe});
 const failure=await once('declined-cycle',async()=>{
  const method=await stripe.paymentMethods.attach('pm_card_chargeCustomerFail',{customer},{idempotencyKey:'launch-cycle:'+plan.plan.id+':decline-method'});
  assert.equal(method.livemode,false);assert.equal(method.customer,customer);
  store.sql.prepare('UPDATE weekly_plans SET payment_method_id=? WHERE customer_id=?').run(method.id,customerId);
  now=Date.parse('2026-11-06T20:00:01Z');const [id]=prepareRecurringTest(store,'review-45');assert.ok(id);
  const existing=store.sql.prepare('SELECT status,payment_intent_id FROM weekly_test_recurring WHERE id=?').get(id);
  const outcome=existing.status==='review_required'&&existing.payment_intent_id?await reconcileRecurringTest(store,id,adapter):await processRecurringTest(store,id,adapter);
  assert.equal(outcome.status,'failed');
  assert.equal((await processRecurringTest(store,id,adapter)).status,'failed');
  assert.equal(store.sql.prepare("SELECT count(*) n FROM weekly_committed_orders WHERE cycle_id='review-45'").get().n,0);
  return {jobId:id,status:'failed',kitchenOrders:0,repeatedChargePrevented:true};
 });
 const cardUpdate=await once('updated-card',async()=>{
  now=Date.parse('2026-11-07T16:00:00Z');
  const setup=await stripe.setupIntents.create({customer,payment_method:originalMethod,usage:'off_session',confirm:true,payment_method_types:['card'],metadata:{weekly_launch_exercise:plan.plan.id}},{idempotencyKey:'launch-cycle:'+plan.plan.id+':card-update'});
  const verified=await stripe.setupIntents.retrieve(setup.id);const method=await stripe.paymentMethods.retrieve(verified.payment_method);
  assert.equal(verified.livemode,false);assert.equal(verified.status,'succeeded');assert.equal(verified.customer,customer);assert.equal(method.customer,customer);assert.equal(method.livemode,false);
  // Explicit operator verification of an actual SetupIntent, not a fabricated webhook/Checkout.
  store.startSetup(customerId,verified.id,customer,plan.plan.id);
  store.completeSetup({eventId:'operator-verified:'+verified.id,setupId:verified.id,stripeCustomerId:customer,paymentMethodId:method.id,livemode:false,status:verified.status});
  const result=await skipUnpaidTestDelivery(store,adapter,customerId,failure.jobId);assert.equal(result.skipped,true);assert.equal(paymentIssues(store,customerId).length,0);
  return {setupIntentId:verified.id,providerVerified:true,unpaidDeliveryCanceledAndSkipped:true};
 });
 const skipped=await once('customer-skip',async()=>{
  now=Date.parse('2026-11-10T16:00:00Z');store.mutate(customerId,{action:'skip',cycleId:'review-46',version:store.row(customerId).version});
  now=Date.parse('2026-11-13T20:00:01Z');assert.deepEqual(prepareRecurringTest(store,'review-46'),[]);return {deliveryDate:'2026-11-14',jobs:0};
 });
 const holidays=await once('holiday-skips',async()=>{
  const results=[];for(const [id,instant] of [['review-47','2026-11-20T20:00:01Z'],['review-48','2026-11-27T20:00:01Z']]){now=Date.parse(instant);assert.deepEqual(prepareRecurringTest(store,id),[]);results.push({cycleId:id,jobs:0})}return results;
 });
 const renewal=await once('successful-renewal',async()=>{
  now=Date.parse('2026-12-04T20:00:01Z');const [id]=prepareRecurringTest(store,'review-49');assert.ok(id);assert.equal((await processRecurringTest(store,id,adapter)).status,'paid');assert.equal((await processRecurringTest(store,id,adapter)).status,'paid');
  const order=JSON.parse(store.sql.prepare('SELECT snapshot FROM weekly_committed_orders WHERE id=?').get(id).snapshot);assert.equal(order.quote.freeMealCount,0);assert.equal(order.quote.fulfillmentMealCount,3);
  return {orderId:id,totalCents:order.totalCents,taxCents:order.taxCents,paidMeals:order.quote.paidMealCount,freeMeals:order.quote.freeMealCount,paymentIntentId:order.paymentIntentId,repeatReusedPaidResult:true};
 });
 const config=JSON.parse(readFileSync(root+'sheets-test-config.json','utf8'));
 const exports=await sendVerifiedTestOrders(store,config);assert.deepEqual(await sendVerifiedTestOrders(store,config),[]);
 const forbidden=store.sql.prepare("SELECT count(*) n FROM weekly_committed_orders WHERE cycle_id IN ('review-45','review-46','review-47','review-48')").get().n;assert.equal(forbidden,0);
 const receipt=JSON.parse(store.sql.prepare('SELECT receipt FROM weekly_test_sheet_receipts WHERE order_id=?').get(renewal.orderId).receipt);
 const report={notice:'STRIPE TEST ONLY. Isolated copied database; advanced clock through Dec 4. Card update verified by actual SetupIntent API, not browser Checkout. No live funds, real delivery, production sheet writes, or customer emails.',failure,cardUpdate,skipped,holidays,renewal,forbiddenKitchenOrders:forbidden,sheet:{exports,receipt},allChecksPassed:true};
 writeFileSync(reportPath,JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
}finally{store.close()}
