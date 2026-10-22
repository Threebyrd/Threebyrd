import {queueWeeklyEmail} from './email-outbox.mjs';
import { createHash } from 'node:crypto';
import { businessDateKey } from '../calendar.ts';
import { previewWeeklyPlan } from '../plan.ts';

// Deliberately local/mock only. No payment SDK, network or production credentials.
export function runMockCutoff(store, cycleId, options = {}) {
 return runMockCycle(store, cycleId, options);
}
export function purchaseMockFirstDelivery(store, customerId) {
 const row=store.row(customerId);
 if(!row || row.plan.status!=='active')throw new Error('No active enrollment.');
 const existing=store.sql.prepare('SELECT snapshot FROM weekly_committed_orders WHERE customer_id=?').all(customerId).find(r=>JSON.parse(r.snapshot).planId===row.plan.id);
 if(existing)return {alreadyPurchased:true};
 const next=store.preview(row.plan).next;
 if(!next || next.status!=='ready')throw new Error('No eligible first delivery.');
 return runMockCycle(store,next.cycle.id,{},customerId);
}
function runMockCycle(store, cycleId, { outcomes = {}, taxBasisPoints = 0 } = {}, signupCustomer = null) {
 if (store.environment !== 'mock') throw new Error('Cutoff simulation requires the mock environment.');
 if (!Number.isSafeInteger(taxBasisPoints) || taxBasisPoints < 0 || taxBasisPoints > 10000) throw new Error('Invalid mock tax rate.');
 const cycle = store.calendar().find(c => c.id === cycleId);
 if (!cycle || (!signupCustomer && store.clock() < Date.parse(cycle.cutoffAt))) throw new Error('The published cutoff has not arrived.');
 // Never retrospectively bill a week after delivery. Late events require support.
 if (businessDateKey(new Date(store.clock())) >= cycle.deliveryDate) throw new Error('Delivery has passed; support review required.');
 return store.transaction(() => {
  const results = [];
  for (const record of store.sql.prepare('SELECT customer_id FROM weekly_plans').all()) {
   const row = store.row(record.customer_id);
   if(signupCustomer && row.customer_id!==signupCustomer)continue;
   const changedAfterCutoff = store.sql.prepare('SELECT 1 FROM weekly_audit WHERE customer_id=? AND at>?').get(row.customer_id,Date.parse(cycle.cutoffAt));
   if(changedAfterCutoff){results.push({customer_id:row.customer_id,status:'support_review_late_change'});continue;}
   const id = createHash('sha256').update(`mock:${row.plan.id}:${cycle.id}`).digest('hex');
   const existing = store.sql.prepare('SELECT * FROM weekly_mock_payments WHERE id=?').get(id);
   if (existing) { results.push(existing); continue; }
   // Unresolved prior payment retains its welcome reservation; do not overlap deliveries.
   const unresolved = store.sql.prepare("SELECT 1 FROM weekly_mock_payments WHERE customer_id=? AND status IN ('failed','requires_action')").get(row.customer_id);
   if (unresolved) { results.push({customer_id:row.customer_id,status:'blocked_prior_payment'}); continue; }
   const decision = previewWeeklyPlan(row.plan, store.calendar(), store.ledger(), new Date(signupCustomer?store.clock():Date.parse(cycle.cutoffAt)-1), store.availability()).cycles.find(c=>c.cycle.id===cycle.id);
   if (row.readiness !== 'staged_ready' || !row.payment_method_id || decision.status !== 'ready') {
    results.push({customer_id:row.customer_id,status:decision.status==='ready'?'payment_method_missing':decision.status}); continue;
   }
   const quote = decision.quote;
   const taxCents = Math.round(quote.subtotalBeforeTaxCents * taxBasisPoints / 10000);
   const snapshot = {environment:'mock',orderType:'weekly',planId:row.plan.id,version:row.version,cycle,quote,taxCents,totalCents:quote.subtotalBeforeTaxCents+taxCents,address:row.deliveryAddress,recipientName:row.recipient_name,mockTaxBasisPoints:taxBasisPoints};
   const status = outcomes[row.customer_id] ?? 'paid';
   if (!['paid','failed','requires_action'].includes(status)) throw new Error('Invalid simulated payment outcome.');
   store.sql.prepare('INSERT INTO weekly_committed_orders VALUES(?,?,?,?)').run(id,row.customer_id,cycle.id,JSON.stringify(snapshot));
   store.sql.prepare('INSERT INTO weekly_mock_payments VALUES(?,?,?,?,?,?)').run(id,row.customer_id,cycle.id,status,snapshot.totalCents,store.clock());
   finish(store,id,status);
   results.push({id,customer_id:row.customer_id,status,amount_cents:snapshot.totalCents});
  }
  return results;
 });
}
function finish(store,id,status) {
 if(status!=='paid') {
  const failed=store.sql.prepare('SELECT * FROM weekly_committed_orders WHERE id=?').get(id);
  queueWeeklyEmail(store,{id:`payment-failed:${id}`,customerId:failed.customer_id,kind:'payment_failed',details:{deliveryDate:JSON.parse(failed.snapshot).cycle.deliveryDate}});return;
 }
 const order=store.sql.prepare('SELECT * FROM weekly_committed_orders WHERE id=?').get(id);
 const snapshot=JSON.parse(order.snapshot);
 queueWeeklyEmail(store,{id:`receipt:${id}`,customerId:order.customer_id,kind:'receipt',details:{name:snapshot.recipientName,deliveryDate:snapshot.cycle.deliveryDate,totalCents:snapshot.totalCents}});
 if(snapshot.quote.welcomeLine) store.sql.prepare('INSERT OR IGNORE INTO weekly_welcome_redemptions VALUES(?,?,?,?)').run(order.customer_id,id,order.cycle_id,new Date(store.clock()).toISOString());
 store.sql.prepare('INSERT OR IGNORE INTO weekly_mock_exports VALUES(?,?,?)').run(id,JSON.stringify({...snapshot,orderId:id,paymentStatus:'paid',firstWeekGift:!!snapshot.quote.welcomeLine}),store.clock());
}
export function resolveMockPayment(store,id,status) {
 if(store.environment!=='mock'||!['paid','abandoned'].includes(status)) throw new Error('Invalid mock payment resolution.');
 return store.transaction(()=>{
  const payment=store.sql.prepare('SELECT * FROM weekly_mock_payments WHERE id=?').get(id);
  if(!payment)throw new Error('Unknown payment.');
  if(payment.status==='paid')return payment;
  if(payment.status==='abandoned')throw new Error('Abandoned orders cannot be recovered.');
  const order=JSON.parse(store.sql.prepare('SELECT snapshot FROM weekly_committed_orders WHERE id=?').get(id).snapshot);
  if(status==='paid'&&businessDateKey(new Date(store.clock()))>=order.cycle.deliveryDate)throw new Error('Delivery has passed; support review required.');
  store.sql.prepare('UPDATE weekly_mock_payments SET status=? WHERE id=?').run(status,id);
  finish(store,id,status);
  return store.sql.prepare('SELECT * FROM weekly_mock_payments WHERE id=?').get(id);
 });
}
export function mockOperations(store) {
 if(store.environment!=='mock')throw new Error('Mock operations only.');
 return {notice:'LOCAL SIMULATION — no Google Sheet writes or real payments',subscribers:store.sql.prepare('SELECT p.customer_id,c.email,p.plan_id,p.data,p.readiness FROM weekly_plans p JOIN weekly_customers c ON c.id=p.customer_id').all().map(r=>({...r,data:JSON.parse(r.data)})),payments:store.sql.prepare('SELECT * FROM weekly_mock_payments').all(),orders:store.sql.prepare('SELECT row_json FROM weekly_mock_exports ORDER BY created_at,order_id').all().map(r=>JSON.parse(r.row_json))};
}
