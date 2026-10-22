import {queueWeeklyEmail} from './email-outbox.mjs';
import { quoteWeeklyPlan } from '../quote.ts';
import { Problem } from './store-core.mjs';

function load(store,customerId,orderId){
 if(store.environment!=='mock')throw new Problem(400,'Paid edits currently support mock payments only.');
 const order=store.sql.prepare('SELECT * FROM weekly_committed_orders WHERE id=? AND customer_id=?').get(orderId,customerId);
 if(!order)throw new Problem(404,'Order not found.');
 const payment=store.sql.prepare('SELECT status FROM weekly_mock_payments WHERE id=?').get(orderId);
 if(payment?.status!=='paid')throw new Problem(409,'Only paid orders can be edited.');
 const base=JSON.parse(order.snapshot);
 if(store.clock()>=Date.parse(base.cycle.cutoffAt))throw new Problem(409,'The cutoff has passed. Contact support.');
 const last=store.sql.prepare('SELECT * FROM weekly_mock_adjustments WHERE order_id=? ORDER BY revision DESC LIMIT 1').get(orderId);
 const successful=store.sql.prepare("SELECT snapshot FROM weekly_mock_adjustments WHERE order_id=? AND outcome='paid' ORDER BY revision DESC LIMIT 1").get(orderId);
 return {snapshot:successful?JSON.parse(successful.snapshot):base,revision:last?.revision??0};
}
export function previewPaidEdit(store,customerId,body){
 const current=load(store,customerId,body.orderId);
 if(!Array.isArray(body.cart)||body.cart.length>30)throw new Problem(400,'Choose valid meals.');
 const cart=body.cart.map(item=>{
  if(!item||typeof item.productId!=='string'||typeof item.sauceId!=='string'||!Number.isSafeInteger(item.quantity))throw new Problem(400,'Choose valid meals.');
  return {productId:item.productId,sauceId:item.sauceId,quantity:item.quantity};
 });
 const welcome=current.snapshot.quote.welcomeLine;
 const quote=quoteWeeklyPlan(cart,welcome?{productId:welcome.productId,sauceId:welcome.sauceId}:null,store.availability());
 if(!quote.isValid)throw new Problem(400,quote.errors.join(' '));
 const taxCents=Math.round(quote.subtotalBeforeTaxCents*current.snapshot.mockTaxBasisPoints/10000);
 const snapshot={...current.snapshot,quote,taxCents,totalCents:quote.subtotalBeforeTaxCents+taxCents};
 return {revision:current.revision,snapshot,deltaCents:snapshot.totalCents-current.snapshot.totalCents};
}
export function savePaidEdit(store,customerId,body){
 if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9_-]{10,100}$/.test(body.requestId))throw new Problem(400,'Missing change request identity.');
 const fingerprint=JSON.stringify({customerId,orderId:body.orderId,cart:body.cart,revision:body.revision,approvedDeltaCents:body.approvedDeltaCents,outcome:body.outcome});
 return store.transaction(()=>{
  const prior=store.sql.prepare('SELECT * FROM weekly_mock_adjustments WHERE id=?').get(body.requestId);
  if(prior){if(prior.request_json!==fingerprint)throw new Problem(409,'Change request already used.');return {outcome:prior.outcome,deltaCents:prior.delta_cents,duplicate:true};}
  const preview=previewPaidEdit(store,customerId,body);
  if(body.revision!==preview.revision)throw new Problem(409,'Order changed. Review the latest amount.');
  if(body.approvedDeltaCents!==preview.deltaCents)throw new Problem(409,'Review and approve the updated payment or refund.');
  if(!['paid','failed'].includes(body.outcome))throw new Problem(400,'Choose a mock payment outcome.');
  store.sql.prepare('INSERT INTO weekly_mock_adjustments VALUES(?,?,?,?,?,?,?,?)').run(body.requestId,body.orderId,preview.revision+1,fingerprint,JSON.stringify(preview.snapshot),preview.deltaCents,body.outcome,store.clock());
  if(body.outcome==='paid'){
   queueWeeklyEmail(store,{id:`adjustment:${body.requestId}`,customerId,kind:'order_changed',details:{name:preview.snapshot.recipientName,deliveryDate:preview.snapshot.cycle.deliveryDate,totalCents:preview.snapshot.totalCents}});
   const exported={...preview.snapshot,orderId:body.orderId,paymentStatus:'paid',firstWeekGift:!!preview.snapshot.quote.welcomeLine,adjustmentRevision:preview.revision+1};
   store.sql.prepare('UPDATE weekly_mock_exports SET row_json=? WHERE order_id=?').run(JSON.stringify(exported),body.orderId);
  }
  return {outcome:body.outcome,deltaCents:preview.deltaCents,revision:preview.revision+1};
 });
}
export function effectivePaidSnapshot(store,orderId,base){
 const table=['stripe_test','stripe_live'].includes(store.environment)?'weekly_test_adjustments':'weekly_mock_adjustments';
 const column=['stripe_test','stripe_live'].includes(store.environment)?'status':'outcome';
 const latest=store.sql.prepare("SELECT snapshot FROM "+table+" WHERE order_id=? AND "+column+"='paid' ORDER BY revision DESC LIMIT 1").get(orderId);
 return latest?JSON.parse(latest.snapshot):base;
}
