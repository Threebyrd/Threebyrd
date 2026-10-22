import {stripeMode,assertAdapter} from './stripe-policy.mjs';
import {randomUUID} from 'node:crypto';
import Stripe from 'stripe';
import {Problem} from './store-core.mjs';
import {quoteWeeklyPlan} from '../quote.ts';
import {queueWeeklyEmail} from './email-outbox.mjs';

function load(store,customerId,orderId){
 stripeMode(store.environment);
 const original=store.sql.prepare('SELECT snapshot FROM weekly_committed_orders WHERE id=? AND customer_id=?').get(orderId,customerId);
 if(!original)throw new Problem(404,'Purchased delivery not found.');
 const base=JSON.parse(original.snapshot);
 if(base.environment!==store.environment||!base.paymentIntentId)throw new Problem(409,'Verified test payment required.');
 if(store.clock()>=Date.parse(base.cycle.cutoffAt))throw new Problem(409,'The cutoff has passed. Contact support.');
 const latest=store.sql.prepare("SELECT revision,snapshot FROM weekly_test_adjustments WHERE order_id=? AND status='paid' ORDER BY revision DESC LIMIT 1").get(orderId);
 return {base,snapshot:latest?JSON.parse(latest.snapshot):base,revision:latest?.revision??0};
}
export async function quoteTestPaidEdit(store,adapter,customerId,{orderId,cart}){
 assertAdapter(store,adapter);
 const current=load(store,customerId,orderId);
 if(!Array.isArray(cart)||cart.length>30||cart.some(i=>!i||typeof i.productId!=='string'||typeof i.sauceId!=='string'||!Number.isSafeInteger(i.quantity)))throw new Problem(400,'Choose valid meals.');
 const quote=quoteWeeklyPlan(cart,current.snapshot.quote.welcomeLine,store.availability());
 if(!quote.isValid)throw new Problem(400,quote.errors.join(' '));
 const id=randomUUID();const tax=await adapter.tax(current.snapshot,quote.subtotalBeforeTaxCents,id);
 const snapshot={...current.snapshot,quote,taxCents:tax.taxCents,totalCents:tax.totalCents};
 if(!Number.isSafeInteger(tax.taxCents)||tax.taxCents<0||tax.totalCents!==quote.subtotalBeforeTaxCents+tax.taxCents)throw new Error('Tax quote mismatch.');
 const deltaCents=snapshot.totalCents-current.snapshot.totalCents,deltaTaxCents=tax.taxCents-current.snapshot.taxCents;
 // We currently sell one tax-code class. Changes across different tax treatments need support.
 if(deltaCents===0&&deltaTaxCents!==0||deltaCents>0&&deltaTaxCents<0||deltaCents<0&&deltaTaxCents>0)throw new Problem(409,'This tax adjustment requires support.');
 const fresh=load(store,customerId,orderId);if(fresh.revision!==current.revision)throw new Problem(409,'Order changed; review a fresh quote.');
 const expiresAt=Math.min(store.clock()+900000,Date.parse(snapshot.cycle.cutoffAt));
 store.sql.prepare("INSERT INTO weekly_test_adjustments VALUES(?,?,?,?,?,?,?,'quoted',?,NULL)").run(id,orderId,customerId,current.revision+1,JSON.stringify(snapshot),deltaCents,deltaTaxCents,expiresAt);
 return {quoteId:id,revision:current.revision,snapshot,deltaCents,expiresAt};
}
export async function saveTestPaidEdit(store,adapter,customerId,{quoteId,approvedDeltaCents}){
 assertAdapter(store,adapter);
 const row=store.transaction(()=>{
  const job=store.sql.prepare('SELECT * FROM weekly_test_adjustments WHERE id=? AND customer_id=?').get(quoteId,customerId);
  if(!job)throw new Problem(404,'Change quote not found.');
  if(job.delta_cents!==approvedDeltaCents)throw new Problem(409,'Approve the exact charge or refund.');
  if(job.status!=='quoted')return {...job,claimed:false};
  const current=load(store,customerId,job.order_id);
  if(current.revision!==job.revision-1||store.clock()>=job.expires_at)throw new Problem(409,'Change quote is stale or expired.');
  if(store.sql.prepare("SELECT 1 FROM weekly_test_adjustments WHERE order_id=? AND status IN ('processing','review_required')").get(job.order_id))throw new Problem(409,'An earlier adjustment needs reconciliation.');
  store.sql.prepare("UPDATE weekly_test_adjustments SET status='processing' WHERE id=?").run(job.id);return {...job,claimed:true,base:current.base};
 });
 if(!row.claimed)return {outcome:row.status,duplicate:true};
 return executeTestPaidEdit(store,adapter,row,customerId);
}
export async function reconcileTestPaidEdit(store,adapter,customerId,quoteId){
 assertAdapter(store,adapter);
 const row=store.transaction(()=>{
  const saved=store.sql.prepare('SELECT * FROM weekly_test_adjustments WHERE id=? AND customer_id=?').get(quoteId,customerId);
  if(saved?.delta_cents>0&&store.clock()>saved.expires_at+12*3600000)throw new Problem(409,'Old uncertain charges require provider inspection, not a new payment request.');
  if(!saved||saved.status!=='review_required')throw new Problem(409,'No uncertain adjustment to reconcile.');
  const current=load(store,customerId,saved.order_id);
  store.sql.prepare("UPDATE weekly_test_adjustments SET status='processing' WHERE id=?").run(quoteId);return {...saved,base:current.base};
 });
 return executeTestPaidEdit(store,adapter,row,customerId);
}
async function executeTestPaidEdit(store,adapter,row,customerId){
 const snapshot=JSON.parse(row.snapshot);
 try{
  const funding=[{paymentIntentId:row.base.paymentIntentId,totalCents:row.base.totalCents,taxCents:row.base.taxCents,taxTransactionId:row.base.taxTransactionId??null}];
  for(const previous of store.sql.prepare("SELECT delta_cents,result FROM weekly_test_adjustments WHERE order_id=? AND status='paid' ORDER BY revision").all(row.order_id)){
   const result=JSON.parse(previous.result);
   if(previous.delta_cents>0)funding.push(result.funding);
   for(const refund of result.refunds??[]){const source=funding.find(f=>f.paymentIntentId===refund.paymentIntentId);if(!source)throw new Error('Missing refund source.');source.totalCents-=refund.totalCents;source.taxCents-=refund.taxCents;}
  }
  const result=await adapter.apply({id:row.id,snapshot,deltaCents:row.delta_cents,deltaTaxCents:row.delta_tax_cents,funding:funding.reverse(),customerId:store.mapping(customerId),paymentMethodId:store.row(customerId).payment_method_id});
  // Preserve provider evidence before the business commit. An interruption blocks further changes.
  store.sql.prepare('UPDATE weekly_test_adjustments SET result=? WHERE id=?').run(JSON.stringify(result),row.id);
  if(result.outcome!=='paid'){
   store.sql.prepare("UPDATE weekly_test_adjustments SET status='failed' WHERE id=?").run(row.id);return {outcome:'failed'};
  }
  return store.transaction(()=>{
   store.sql.prepare("UPDATE weekly_test_adjustments SET status='paid' WHERE id=?").run(row.id);
   const exported={...snapshot,orderId:row.order_id,paymentStatus:'paid',adjustmentRevision:row.revision};
   store.sql.prepare('INSERT INTO weekly_test_sheet_updates VALUES(?,?,?,?,NULL)').run(row.order_id,row.revision,JSON.stringify(exported),store.clock());
   queueWeeklyEmail(store,{id:`adjustment:${row.id}`,customerId,kind:'order_changed',details:{name:snapshot.recipientName,deliveryDate:snapshot.cycle.deliveryDate,totalCents:snapshot.totalCents}});
   return {outcome:'paid',deltaCents:row.delta_cents,revision:row.revision};
  });
 }catch{
  store.sql.prepare("UPDATE weekly_test_adjustments SET status='review_required' WHERE id=? AND status='processing'").run(row.id);
  return {outcome:'review_required'};
 }
}
export function createTestEditAdapter(options){return editAdapter({...options,key:options.testKey,live:false})}
export function createLiveEditAdapter(options){return editAdapter({...options,key:options.liveKey,live:true})}
function editAdapter({key,taxCode,stripeClient,live}){
 if(!(live?/^sk_live_/:/^sk_test_/).test(key??'')||!/^txcd_\d+$/.test(taxCode??''))throw new Error('Dedicated test credentials required.');
 const stripe=stripeClient??new Stripe(key);
 async function tax(snapshot,subtotal,id){
  const a=snapshot.address;
  const calc=await stripe.tax.calculations.create({currency:'usd',customer_details:{address:{line1:a.streetAddress,city:a.city,state:a.state,postal_code:a.zipCode,country:'US'},address_source:'shipping'},line_items:[{amount:subtotal,reference:id,tax_behavior:'exclusive',tax_code:taxCode}]},{idempotencyKey:`paid-edit:${id}:tax`});
  return {taxCents:calc.tax_amount_exclusive,totalCents:calc.amount_total,calculationId:calc.id};
 }
 return {environment:live?'stripe_live':'stripe_test',tax,async apply(change){
  const {id,snapshot,deltaCents,deltaTaxCents,customerId,paymentMethodId}=change;
  if(deltaCents===0)return {outcome:'paid',refunds:[]};
  const customer=await stripe.customers.retrieve(customerId);const method=await stripe.paymentMethods.retrieve(paymentMethodId);
  if(customer.deleted||customer.livemode!==live||method.livemode!==live||method.customer!==customerId)throw new Error('Test ownership mismatch.');
  if(deltaCents>0){
   const calc=await tax(snapshot,deltaCents-deltaTaxCents,id+':delta');
   if(calc.totalCents!==deltaCents||calc.taxCents!==deltaTaxCents)throw new Error('Delta tax requires support.');
   let intent;
   try{intent=await stripe.paymentIntents.create({amount:deltaCents,currency:'usd',customer:customerId,payment_method:paymentMethodId,payment_method_types:['card'],confirm:true,off_session:true,metadata:{weekly_edit_id:id}},{idempotencyKey:`paid-edit:${id}:payment`})}catch(error){if(error.type==='StripeCardError')return {outcome:'failed',paymentIntentId:error.payment_intent?.id};throw error;}
   const verified=await stripe.paymentIntents.retrieve(intent.id);
   if(verified.livemode!==live||verified.status!=='succeeded'||verified.amount_received!==deltaCents||verified.amount!==deltaCents||verified.currency!=='usd'||verified.customer!==customerId||verified.payment_method!==paymentMethodId||verified.metadata?.weekly_edit_id!==id)throw new Error('Additional payment not verified.');
   const transaction=await stripe.tax.transactions.createFromCalculation({calculation:calc.calculationId,reference:`paid-edit:${id}`},{idempotencyKey:`paid-edit:${id}:tax-transaction`});
   return {outcome:'paid',funding:{paymentIntentId:intent.id,totalCents:deltaCents,taxCents:deltaTaxCents,taxTransactionId:transaction.id}};
  }
  let remaining=-deltaCents,taxRemaining=-deltaTaxCents;const portions=[];
  for(const source of change.funding){
   if(!remaining)break;
   const totalCents=Math.min(remaining,source.totalCents);if(totalCents<=0)continue;
   const taxCents=totalCents===source.totalCents?source.taxCents:Math.round(totalCents*source.taxCents/source.totalCents);
   portions.push({...source,totalCents,taxCents});remaining-=totalCents;taxRemaining-=taxCents;
  }
  if(remaining||taxRemaining)throw new Error('Refund tax allocation requires support.');
  // Verify every source before issuing the first refund.
  for(const portion of portions){
   const pi=await stripe.paymentIntents.retrieve(portion.paymentIntentId);
   if(pi.livemode!==live||pi.customer!==customerId||pi.status!=='succeeded'||pi.currency!=='usd'||typeof pi.latest_charge!=='string')throw new Error('Refund ownership mismatch.');
   const existing=await stripe.refunds.list({payment_intent:portion.paymentIntentId,limit:100});
   portion.existingRefund=existing.data.find(r=>r.metadata?.weekly_edit_id===id&&r.status==='succeeded'&&r.amount===portion.totalCents);
   const charge=await stripe.charges.retrieve(pi.latest_charge);
   if(charge.amount-charge.amount_refunded+(portion.existingRefund?.amount??0)<portion.totalCents)throw new Error('Refund was changed externally.');
  }
  const refunds=[];
  for(const portion of portions){
   const refund=portion.existingRefund??await stripe.refunds.create({payment_intent:portion.paymentIntentId,amount:portion.totalCents,reason:'requested_by_customer',metadata:{weekly_edit_id:id}},{idempotencyKey:`paid-edit:${id}:refund:${portion.paymentIntentId}`});
   if(refund.status!=='succeeded'||refund.amount!==portion.totalCents||refund.payment_intent!==portion.paymentIntentId)throw new Error('Refund is not complete.');
   // Checkout's automatic tax is reversed by Stripe; manually recorded recurring tax needs its own reversal.
   let taxReversalId=null;
   if(portion.taxTransactionId){
    const original=await stripe.tax.transactions.retrieve(portion.taxTransactionId,{expand:['line_items']});
    if(original.line_items.data.length!==1||original.line_items.has_more)throw new Error('Unexpected tax transaction lines.');
    const reversal=await stripe.tax.transactions.createReversal({mode:'partial',original_transaction:portion.taxTransactionId,reference:`paid-edit:${id}:${portion.paymentIntentId}`,line_items:[{original_line_item:original.line_items.data[0].id,reference:`refund:${id}`,amount:-(portion.totalCents-portion.taxCents),amount_tax:-portion.taxCents}]},{idempotencyKey:`paid-edit:${id}:reverse-tax:${portion.paymentIntentId}`});taxReversalId=reversal.id;
   }
   refunds.push({paymentIntentId:portion.paymentIntentId,totalCents:portion.totalCents,taxCents:portion.taxCents,refundId:refund.id,taxReversalId});
  }
  return {outcome:'paid',refunds};
 }};
}
