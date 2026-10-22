import {assertAdapter} from './stripe-policy.mjs';
import {queueWeeklyEmail} from './email-outbox.mjs';
import {randomUUID} from 'node:crypto';
import {Problem} from './store-core.mjs';

export async function startTestPurchase(store,adapter,customerId){
 assertAdapter(store,adapter);
 const purchase=store.transaction(()=>{
  const row=store.row(customerId);
  if(!row||row.plan.status!=='active')throw new Problem(409,'Enroll in an active plan first.');
  const old=store.sql.prepare('SELECT * FROM weekly_test_purchases WHERE plan_id=?').get(row.plan.id);
  if(old){if(old.status==='paid')throw new Problem(409,'First delivery already purchased.');return {...JSON.parse(old.snapshot),sessionId:old.session_id};}
  const auth=store.sql.prepare('SELECT 1 FROM weekly_authorizations WHERE customer_id=? AND plan_id=? AND disclosure_version=?').get(customerId,row.plan.id,store.disclosureVersion);
  if(!auth)throw new Problem(409,'Review the current payment authorization.');
  const decision=store.preview(row.plan).next;const mapped=store.mapping(customerId);
  if(!mapped||!decision||decision.status!=='ready')throw new Problem(409,'No valid first delivery or test customer.');
  const p={id:randomUUID(),customerId,stripeCustomerId:mapped,planId:row.plan.id,cycleId:decision.cycle.id,cutoffAt:decision.cycle.cutoffAt,cycle:decision.cycle,quote:decision.quote,address:row.deliveryAddress,recipientName:row.recipient_name,version:row.version};
  if(store.sql.prepare("SELECT 1 FROM weekly_test_purchases WHERE customer_id=? AND status='pending'").get(customerId))throw new Problem(409,'An earlier payment is pending. Contact support before another signup.');
  store.sql.prepare('INSERT INTO weekly_test_purchases VALUES(?,?,?,?,?,NULL,?,?)').run(p.id,customerId,p.planId,p.cycleId,JSON.stringify(p),'pending',store.clock());return p;
 });
 if(store.clock()>=Date.parse(purchase.cutoffAt))throw new Problem(409,'This delivery cutoff has passed. Contact support to resolve the pending checkout.');
 const session=await adapter.checkout(purchase);
 store.sql.prepare('UPDATE weekly_test_purchases SET session_id=? WHERE id=? AND (session_id IS NULL OR session_id=?)').run(session.id,purchase.id,session.id);
 return session;
}
export async function receiveTestPurchase(store,adapter,payload,signature){
 assertAdapter(store,adapter);
 const event=await adapter.reconcile(payload,signature,async sessionId=>{
  const row=store.sql.prepare('SELECT snapshot FROM weekly_test_purchases WHERE session_id=?').get(sessionId);
  return row?JSON.parse(row.snapshot):null;
 });
 if(!event)return {ignored:true};
 if(event.environment&&event.environment!==store.environment)throw new Problem(409,'Payment environment mismatch.');
 return store.transaction(()=>{
  if(store.sql.prepare('SELECT 1 FROM weekly_test_paid_events WHERE event_id=?').get(event.eventId))return {duplicate:true};
  const row=store.sql.prepare('SELECT * FROM weekly_test_purchases WHERE id=? AND session_id=?').get(event.purchaseId,event.sessionId);
  if(!row||row.customer_id!==event.customerId)throw new Problem(409,'Saved purchase not found.');
  if(row.status==='paid')return {duplicate:true};
  const p=JSON.parse(row.snapshot);
  if(p.quote.welcomeLine&&store.ledger().some(r=>r.verifiedCustomerId===p.customerId))throw new Problem(409,'Welcome entitlement conflict; support review required.');
  const snapshot={...p,environment:store.environment,orderType:'weekly',taxCents:event.taxCents,totalCents:event.totalCents,sessionId:event.sessionId,paymentIntentId:event.paymentIntentId};
  store.sql.prepare('INSERT INTO weekly_committed_orders VALUES(?,?,?,?)').run(p.id,p.customerId,p.cycleId,JSON.stringify(snapshot));
  if(p.quote.welcomeLine)store.sql.prepare('INSERT INTO weekly_welcome_redemptions VALUES(?,?,?,?)').run(p.customerId,p.id,p.cycleId,new Date(store.clock()).toISOString());
  store.sql.prepare('INSERT INTO weekly_test_exports VALUES(?,?,?)').run(p.id,JSON.stringify({...snapshot,orderId:p.id,paymentStatus:'paid',firstWeekGift:!!p.quote.welcomeLine}),store.clock());
  store.sql.prepare("UPDATE weekly_test_purchases SET status='paid' WHERE id=?").run(p.id);
  store.sql.prepare('INSERT INTO weekly_test_paid_events VALUES(?,?,?)').run(event.eventId,p.id,store.clock());
  store.sql.prepare("UPDATE weekly_plans SET readiness='staged_ready',payment_method_id=?,version=version+1 WHERE customer_id=? AND plan_id=?").run(event.paymentMethodId,p.customerId,p.planId);
  queueWeeklyEmail(store,{id:`receipt:${p.id}`,customerId:p.customerId,kind:'receipt',details:{name:p.recipientName,deliveryDate:p.cycle.deliveryDate,totalCents:event.totalCents}});
  return {paid:true,orderId:p.id};
 });
}
