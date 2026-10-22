import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {quoteWeeklyPlan} from '../app/subscriptions/quote.ts';
import {createTestPurchases} from '../app/subscriptions/sandbox/stripe-purchase.mjs';
import {weeklyPaymentParams} from '../app/subscriptions/sandbox/stripe-purchase.ts';
const purchase={id:'purchase-1',customerId:'verified-1',stripeCustomerId:'cus_test',planId:'plan-1',cycleId:'cycle-1',cutoffAt:'2026-10-30T19:00:00Z',quote:quoteWeeklyPlan([{productId:'big-chicken',quantity:3,sauceId:'bbq'}],{productId:'big-beef',sauceId:'bbq'}),address:{streetAddress:'123 State St',city:'Ithaca',state:'NY',zipCode:'14850'},recipientName:'Fictional Test'};
function fixture(){
 const signer=new Stripe('sk_test_fixture');const secret='whsec_fixture';const calls=[];
 const session={id:'cs_test_first',livemode:false,mode:'payment',status:'complete',payment_status:'paid',currency:'usd',automatic_tax:{status:'complete'},payment_intent:'pi_test_first',customer:'cus_test',metadata:{weekly_purchase_id:'purchase-1',weekly_plan_id:'plan-1',weekly_customer_id:'verified-1',weekly_cycle_id:'cycle-1'},amount_subtotal:3150,amount_total:3402,total_details:{amount_tax:252,amount_discount:0,amount_shipping:0}};
 const intent={id:'pi_test_first',livemode:false,status:'succeeded',customer:'cus_test',amount_received:3402,amount:3402,currency:'usd',setup_future_usage:'off_session',payment_method:'pm_test',metadata:{weekly_purchase_id:'purchase-1'}};
 const client={webhooks:signer.webhooks,customers:{retrieve:async()=>({livemode:false}),update:async()=>({})},checkout:{sessions:{create:async(params,options)=>{calls.push({params,options});return {id:session.id,url:'https://checkout.stripe.com/test',livemode:false}},retrieve:async()=>session}},paymentIntents:{retrieve:async()=>intent},paymentMethods:{retrieve:async()=>({id:'pm_test',customer:'cus_test',livemode:false})}};
 const api=createTestPurchases({testKey:'sk_test_fixture',webhookSecret:secret,baseUrl:'http://localhost:3012',taxCode:'txcd_40060003',stripeClient:client});
 const payload=JSON.stringify({id:'evt_test',type:'checkout.session.completed',livemode:false,data:{object:{id:session.id}}});const signature=signer.webhooks.generateTestHeaderString({payload,secret});
 return {api,session,intent,calls,payload,signature};
}
test('first-payment Checkout charges discounted meals, includes any-size gift and saves card for later weeks',async()=>{
 const f=fixture();await f.api.checkout(purchase);const {params,options}=f.calls[0];assert.equal(params.mode,'payment');assert.equal(params.payment_intent_data.setup_future_usage,'off_session');assert.equal(params.automatic_tax.enabled,true);assert.equal(params.line_items.reduce((n,l)=>n+l.price_data.unit_amount*l.quantity,0),3150);assert.deepEqual(params.line_items.slice(0,3).map(l=>l.price_data.unit_amount),[1050,1050,1050]);assert.equal(params.line_items.at(-1).price_data.unit_amount,0);assert.equal(options.idempotencyKey,'weekly-first-payment:purchase-1');
 const result=await f.api.reconcile(f.payload,f.signature,async()=>purchase);assert.equal(result.taxCents,252);assert.equal(result.paymentMethodId,'pm_test');
});
test('signed events still require matching ownership, exact amounts, successful tax and attached method',async()=>{
 for(const mutate of [f=>f.session.customer='cus_other',f=>f.session.amount_total++,f=>f.session.automatic_tax.status='failed',f=>f.intent.status='requires_action',f=>f.intent.livemode=true,f=>f.intent.amount_received--]){const f=fixture();mutate(f);await assert.rejects(()=>f.api.reconcile(f.payload,f.signature,async()=>purchase));}
 const f=fixture();await assert.rejects(()=>f.api.reconcile(f.payload,'invalid',async()=>purchase));await assert.rejects(()=>f.api.reconcile(f.payload,f.signature,async()=>null));
});
test('payment adapter rejects live credentials and invalid quote totals',()=>{
 assert.throws(()=>createTestPurchases({testKey:'sk_live_no',webhookSecret:'whsec_no',baseUrl:'http://localhost:3012'}));assert.throws(()=>weeklyPaymentParams('http://localhost:3012',{...purchase,quote:{...purchase.quote,subtotalBeforeTaxCents:1}},'txcd_40060003'));
});

test('saved first purchase binds Checkout, deduplicates signed success, and queues paid fulfillment once',async()=>{
 const {WeeklyStore,DISCLOSURE_VERSION}=await import('../app/subscriptions/sandbox/store.mjs');
 const {sampleCalendar}=await import('../scripts/weekly-sandbox/server.mjs');
 const {startTestPurchase,receiveTestPurchase}=await import('../app/subscriptions/sandbox/first-payment.mjs');
 const store=new WeeklyStore(':memory:',{environment:'stripe_test',clock:()=>Date.parse('2026-10-21T17:00:00Z')});
 try{
  store.publish(sampleCalendar());const customer=store.verify(store.requestLink('test@example.test','test').token).customer;
  store.enroll(customer.id,{cart:[{productId:'big-chicken',quantity:3,sauceId:'bbq'}],welcome:{productId:'big-beef',sauceId:'bbq'},recipientName:'Fictional Person',authorized:true,disclosureVersion:DISCLOSURE_VERSION},purchase.address);store.saveMapping(customer.id,'cus_test');
  let pending;const adapter={checkout:async p=>{pending=p;return {id:'cs_test_bound',url:'https://checkout.stripe.com/test'}},reconcile:async(_p,_s,lookup)=>{const p=await lookup('cs_test_bound');assert.equal(p.id,pending.id);return {eventId:'evt_bound',purchaseId:p.id,sessionId:'cs_test_bound',customerId:customer.id,paymentMethodId:'pm_test',paymentIntentId:'pi_test',totalCents:3402,taxCents:252}}};
  await startTestPurchase(store,adapter,customer.id);await startTestPurchase(store,adapter,customer.id);
  assert.equal(store.sql.prepare('SELECT count(*) n FROM weekly_test_purchases').get().n,1);
  assert.equal(store.ledger().length,0);assert.equal(store.sql.prepare('SELECT count(*) n FROM weekly_test_exports').get().n,0);
  await receiveTestPurchase(store,adapter,'signed-fixture','signature');assert.equal((await receiveTestPurchase(store,adapter,'signed-fixture','signature')).duplicate,true);
  assert.equal(store.ledger().length,1);assert.equal(store.sql.prepare('SELECT count(*) n FROM weekly_test_exports').get().n,1);
  assert.equal(store.state(customer.id).committedOrders.length,1);assert.equal(store.state(customer.id).paymentMethodSaved,true);
 }finally{store.close()}
});
