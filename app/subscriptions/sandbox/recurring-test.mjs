import {stripeMode,assertAdapter} from './stripe-policy.mjs';
import {createHash} from 'node:crypto';
import Stripe from 'stripe';
import {previewWeeklyPlan} from '../plan.ts';
import {businessDateKey} from '../calendar.ts';
import {queueWeeklyEmail} from './email-outbox.mjs';

/** Isolated test-only cutoff. No cron or public route enables this runner. */
export function prepareRecurringTest(store,cycleId){
 stripeMode(store.environment);
 const cycle=store.calendar().find(c=>c.id===cycleId);
 if(!cycle||store.clock()<Date.parse(cycle.cutoffAt)||businessDateKey(new Date(store.clock()))>=cycle.deliveryDate)throw new Error('Outside the published billing window.');
 return store.transaction(()=>{
  const jobs=[];
  for(const customer of store.sql.prepare('SELECT customer_id FROM weekly_plans').all()){
   const row=store.row(customer.customer_id);
   const existing=store.sql.prepare('SELECT id FROM weekly_test_recurring WHERE customer_id=? AND cycle_id=?').get(row.customer_id,cycleId);
   if(existing){jobs.push(existing.id);continue;}
   if(store.locks(row.customer_id).includes(cycleId))continue;
   if(store.sql.prepare("SELECT 1 FROM weekly_test_recurring j LEFT JOIN weekly_payment_resolutions r ON r.job_id=j.id WHERE j.customer_id=? AND j.status!='paid' AND r.job_id IS NULL").get(row.customer_id))continue;
   if(store.sql.prepare('SELECT 1 FROM weekly_audit WHERE customer_id=? AND at>?').get(row.customer_id,Date.parse(cycle.cutoffAt)))continue;
   if(row.readiness!=='staged_ready'||!row.payment_method_id||!store.mapping(row.customer_id))continue;
   // Require a verified first purchase; setup-only test plans cannot recur.
   if(!store.sql.prepare("SELECT 1 FROM weekly_test_purchases WHERE customer_id=? AND plan_id=? AND status='paid'").get(row.customer_id,row.plan.id))continue;
   const decision=previewWeeklyPlan(row.plan,store.calendar(),store.ledger(),new Date(Date.parse(cycle.cutoffAt)-1),store.availability()).cycles.find(d=>d.cycle.id===cycleId);
   if(decision.status!=='ready')continue;
   const id=createHash('sha256').update(`${store.environment==='stripe_test'?'stripe-test':store.environment}-recurring:${row.plan.id}:${cycleId}`).digest('hex');
   const snapshot={id,customerId:row.customer_id,planId:row.plan.id,version:row.version,cycle,quote:decision.quote,address:row.deliveryAddress,recipientName:row.recipient_name,stripeCustomerId:store.mapping(row.customer_id),paymentMethodId:row.payment_method_id,environment:store.environment,orderType:'weekly'};
   store.sql.prepare("INSERT INTO weekly_test_recurring VALUES(?,?,?,?, 'prepared',NULL,NULL,?)").run(id,row.customer_id,cycleId,JSON.stringify(snapshot),store.clock());jobs.push(id);
  }
  return jobs;
 });
}
export function createRecurringTestAdapter(options){return recurringAdapter({...options,key:options.testKey,live:false})}
export function createRecurringLiveAdapter(options){return recurringAdapter({...options,key:options.liveKey,live:true})}
function recurringAdapter({key,taxCode,stripeClient,live}){
 if(!(live?/^sk_live_/:/^sk_test_/).test(key??'')||!/^txcd_\d+$/.test(taxCode??''))throw new Error('Dedicated test key and tax code required.');
 const stripe=stripeClient??new Stripe(key);
 return {
  environment:live?'stripe_live':'stripe_test',
  async create(snapshot){
   const customer=await stripe.customers.retrieve(snapshot.stripeCustomerId);
   const method=await stripe.paymentMethods.retrieve(snapshot.paymentMethodId);
   if(customer.deleted||customer.livemode!==live||method.livemode!==live||method.customer!==customer.id)throw new Error('Test ownership mismatch.');
   const calculation=await stripe.tax.calculations.create({currency:'usd',customer_details:{address:{line1:snapshot.address.streetAddress,city:snapshot.address.city,state:snapshot.address.state,postal_code:snapshot.address.zipCode,country:'US'},address_source:'shipping'},line_items:[{amount:snapshot.quote.subtotalBeforeTaxCents,reference:snapshot.id,tax_behavior:'exclusive',tax_code:taxCode}]},{idempotencyKey:`recurring:${snapshot.id}:tax`});
   if(!Number.isSafeInteger(calculation.amount_total)||calculation.amount_total!==snapshot.quote.subtotalBeforeTaxCents+calculation.tax_amount_exclusive)throw new Error('Tax does not reconcile.');
   const intent=await stripe.paymentIntents.create({amount:calculation.amount_total,currency:'usd',customer:customer.id,payment_method:method.id,payment_method_types:['card'],metadata:{weekly_recurring_id:snapshot.id,weekly_plan_id:snapshot.planId,tax_calculation:calculation.id}},{idempotencyKey:`recurring:${snapshot.id}:create`});
   if(intent.livemode!==live)throw new Error('Unexpected payment environment.');
   return {intentId:intent.id,taxCents:calculation.tax_amount_exclusive,totalCents:calculation.amount_total,taxCalculationId:calculation.id};
  },
  async confirm(intentId,id){
   try{return await stripe.paymentIntents.confirm(intentId,{off_session:true},{idempotencyKey:`recurring:${id}:confirm`})}
   catch(error){if(error.type==='StripeCardError'&&error.payment_intent?.id===intentId)return error.payment_intent;throw error;}
  },
  retrieve:id=>stripe.paymentIntents.retrieve(id),
  cancelFailed:(id,jobId)=>stripe.paymentIntents.cancel(id,{}, {idempotencyKey:`recurring:${jobId}:cancel-unpaid`}),
  recordTax:async(snapshot,result)=>{
   const transaction=await stripe.tax.transactions.createFromCalculation({calculation:result.taxCalculationId,reference:snapshot.id},{idempotencyKey:`recurring:${snapshot.id}:tax-transaction`});return transaction.id;
  },
 };
}
export async function processRecurringTest(store,id,adapter){
 assertAdapter(store,adapter);
 const claim=store.transaction(()=>{
  const job=store.sql.prepare('SELECT * FROM weekly_test_recurring WHERE id=?').get(id);
  if(!job)throw new Error('Unknown recurring job.');
  if(job.status!=='prepared')return {job,claimed:false};
  store.sql.prepare("UPDATE weekly_test_recurring SET status='processing' WHERE id=?").run(id);return {job,claimed:true};
 });
 const {job}=claim;const snapshot=JSON.parse(job.snapshot);
 if(job.status==='paid'||job.status==='failed'||job.status==='requires_action'||job.status==='review_required')return {status:job.status};
 if(!claim.claimed)return {status:'processing'}; // Another worker or interrupted claim needs operator reconciliation.
 try{
  // Persist the PaymentIntent before confirmation so a retry never creates a new charge.
  const result=await adapter.create(snapshot);
  store.sql.prepare('UPDATE weekly_test_recurring SET payment_intent_id=?,result=? WHERE id=?').run(result.intentId,JSON.stringify(result),id);
  await adapter.confirm(result.intentId,id);
  return await reconcileRecurringTest(store,id,adapter);
 }catch{
  store.sql.prepare("UPDATE weekly_test_recurring SET status='review_required' WHERE id=? AND status='processing'").run(id);
  return {status:'review_required'};
 }
}
export async function reconcileRecurringTest(store,id,adapter){
 const live=assertAdapter(store,adapter);
 const row=store.sql.prepare('SELECT * FROM weekly_test_recurring WHERE id=?').get(id);
 if(!row?.payment_intent_id)throw new Error('No persisted payment to reconcile.');
 if(row.status==='paid')return {status:'paid',duplicate:true};
 const snapshot=JSON.parse(row.snapshot),result=JSON.parse(row.result);
 const intent=await adapter.retrieve(row.payment_intent_id);
 // Stripe may clear payment_method on a declined intent. Only accept the
 // exact attempted method from Stripe's last error for a definitive decline.
 const declinedMethod=intent.status==='requires_payment_method'&&intent.payment_method===null?intent.last_payment_error?.payment_method?.id:null;
 const methodMatches=intent.payment_method===snapshot.paymentMethodId||declinedMethod===snapshot.paymentMethodId;
 if(intent.id!==row.payment_intent_id||intent.livemode!==live||intent.customer!==snapshot.stripeCustomerId||!methodMatches||intent.metadata?.weekly_recurring_id!==id||intent.metadata?.weekly_plan_id!==snapshot.planId||intent.metadata?.tax_calculation!==result.taxCalculationId||intent.currency!=='usd'||intent.amount!==result.totalCents)throw new Error('Recurring payment reconciliation mismatch.');
 const status=intent.status==='succeeded'?'paid':intent.status==='requires_action'?'requires_action':intent.status==='requires_payment_method'||intent.status==='canceled'?'failed':'processing';
 if(status==='paid'&&intent.amount_received!==result.totalCents)throw new Error('Recurring payment amount mismatch.');
 // Paid late must be resolved by support, never silently prepared for a past delivery.
 if(status==='paid'&&businessDateKey(new Date(store.clock()))>=snapshot.cycle.deliveryDate){store.sql.prepare("UPDATE weekly_test_recurring SET status='review_required' WHERE id=?").run(id);return {status:'review_required'};}
 const taxTransactionId=status==='paid'?await adapter.recordTax(snapshot,result):null;
 return store.transaction(()=>{
  const latest=store.sql.prepare('SELECT status FROM weekly_test_recurring WHERE id=?').get(id);
  if(latest.status==='paid')return {status:'paid',duplicate:true};
  store.sql.prepare('UPDATE weekly_test_recurring SET status=?,result=? WHERE id=?').run(status,JSON.stringify({...result,taxTransactionId}),id);
  if(status==='paid'){
   const order={...snapshot,taxCents:result.taxCents,totalCents:result.totalCents,paymentIntentId:intent.id,taxTransactionId,paymentStatus:'paid',orderId:id};
   store.sql.prepare('INSERT INTO weekly_committed_orders VALUES(?,?,?,?)').run(id,row.customer_id,row.cycle_id,JSON.stringify(order));
   store.sql.prepare('INSERT INTO weekly_test_exports VALUES(?,?,?)').run(id,JSON.stringify(order),store.clock());
   queueWeeklyEmail(store,{id:`receipt:${id}`,customerId:row.customer_id,kind:'receipt',details:{name:snapshot.recipientName,deliveryDate:snapshot.cycle.deliveryDate,totalCents:result.totalCents}});
  }else if(['failed','requires_action'].includes(status))queueWeeklyEmail(store,{id:`payment-failed:${id}`,customerId:row.customer_id,kind:'payment_failed',details:{deliveryDate:snapshot.cycle.deliveryDate}});
  return {status,orderId:status==='paid'?id:undefined};
 });
}
