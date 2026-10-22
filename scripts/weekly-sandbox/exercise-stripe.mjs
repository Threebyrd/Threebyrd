// Explicit operator-invoked test exercise. Never a scheduler or production billing entry point.
import Stripe from 'stripe';
import {readFileSync,writeFileSync} from 'node:fs';
import {WeeklyStore} from '../../app/subscriptions/sandbox/store.mjs';
const root='.local-previews/weekly-stage3/';
const key=readFileSync(root+'stripe-test-key','utf8').trim();
if(!/^sk_test_/.test(key))throw new Error('Only test keys allowed.');
const stripe=new Stripe(key);const store=new WeeklyStore(root+'stripe-test.sqlite',{environment:'stripe_test'});
store.sql.exec('CREATE TABLE IF NOT EXISTS weekly_test_exercises (id TEXT PRIMARY KEY, result TEXT NOT NULL)');
async function once(id,fn){const row=store.sql.prepare('SELECT result FROM weekly_test_exercises WHERE id=?').get(id);if(row)return JSON.parse(row.result);const result=await fn();store.sql.prepare('INSERT INTO weekly_test_exercises VALUES(?,?)').run(id,JSON.stringify(result));return result;}
try{
 const row=store.sql.prepare("SELECT customer_id,snapshot FROM weekly_test_purchases WHERE status='paid' ORDER BY created_at LIMIT 1").get();
 if(!row)throw new Error('First test purchase required.');
 const purchase=JSON.parse(row.snapshot);const plan=store.row(row.customer_id);
 const customer=await stripe.customers.retrieve(purchase.stripeCustomerId);
 const method=await stripe.paymentMethods.retrieve(plan.payment_method_id);
 if(customer.livemode!==false||method.livemode!==false||method.customer!==customer.id)throw new Error('Test ownership mismatch.');
 async function charge(id,subtotal,customerId=customer.id,methodId=method.id){
  const calculation=await stripe.tax.calculations.create({currency:'usd',customer_details:{address:{line1:purchase.address.streetAddress,city:purchase.address.city,state:purchase.address.state,postal_code:purchase.address.zipCode,country:'US'},address_source:'shipping'},line_items:[{amount:subtotal,reference:id,tax_behavior:'exclusive',tax_code:'txcd_40060003'}]},{idempotencyKey:id+':tax'});
  const pi=await stripe.paymentIntents.create({amount:calculation.amount_total,currency:'usd',customer:customerId,payment_method:methodId,payment_method_types:['card'],confirm:true,off_session:true,metadata:{weekly_test_exercise:id,weekly_plan_id:purchase.planId,tax_calculation:calculation.id}},{idempotencyKey:id+':payment'});
  if(pi.livemode!==false||pi.status!=='succeeded'||pi.amount_received!==calculation.amount_total)throw new Error('Test payment not successful.');
  const tax=await stripe.tax.transactions.createFromCalculation({calculation:calculation.id,reference:id},{idempotencyKey:id+':tax-transaction'});
  return {id,environment:'stripe_test',paymentIntentId:pi.id,status:pi.status,subtotalCents:subtotal,taxCents:calculation.tax_amount_exclusive,totalCents:pi.amount_received,taxTransactionId:tax.id};
 }
 const prefix='weekly-test:'+purchase.id;
 const recurring=await once(prefix+':recurring',()=>charge(prefix+':recurring',purchase.quote.subtotalBeforeTaxCents));
 const extra=await once(prefix+':extra',()=>charge(prefix+':extra',1050));
 const refund=await once(prefix+':refund',async()=>{
  const r=await stripe.refunds.create({payment_intent:extra.paymentIntentId,amount:extra.totalCents,metadata:{weekly_test_exercise:prefix+':refund'}},{idempotencyKey:prefix+':refund'});
  if(r.status!=='succeeded')throw new Error('Refund not complete.');
  const reversal=await stripe.tax.transactions.createReversal({mode:'full',original_transaction:extra.taxTransactionId,reference:prefix+':refund-tax'},{idempotencyKey:prefix+':refund-tax'});
  return {refundId:r.id,status:r.status,amountCents:r.amount,taxReversalId:reversal.id};
 });
 const failure=await once(prefix+':failure',async()=>{
  const c=await stripe.customers.create({email:'weekly-decline@example.test',metadata:{weekly_test_exercise:prefix+':failure'}},{idempotencyKey:prefix+':failure-customer'});
  const pm=await stripe.paymentMethods.attach('pm_card_chargeCustomerFail',{customer:c.id},{idempotencyKey:prefix+':failure-method-v2'});
  try{await charge(prefix+':failure',3150,c.id,pm.id);throw new Error('Expected decline did not occur.');}catch(error){if(error.type!=='StripeCardError')throw error;return {status:'failed',code:error.code,paymentIntentId:error.payment_intent?.id??null,exported:false};}
 });
 const report={notice:'STRIPE SANDBOX ONLY — manual exercise, no delivery or customer emails',recurring,extra,refund,failure};
 writeFileSync(root+'stripe-exercise-results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{store.close()}
