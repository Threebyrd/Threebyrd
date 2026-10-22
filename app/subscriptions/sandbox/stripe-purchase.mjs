import Stripe from 'stripe';
import { weeklyPaymentParams } from './stripe-purchase.ts';

/** Test-only adapter. Server-owned purchase lookup is mandatory; browser values are never authority. */
export function createTestPurchases(options){return createPurchases({...options,key:options.testKey,live:false})}
export function createLivePurchases(options){return createPurchases({...options,key:options.liveKey,live:true})}
function createPurchases({key,webhookSecret,baseUrl,taxCode,stripeClient,live}){
 if(!(live?/^(sk|rk)_live_/:/^(sk|rk)_test_/).test(key??'')||!webhookSecret?.startsWith('whsec_'))throw new Error('Dedicated Stripe test credentials are required.');
 if(live?baseUrl!=='https://weekly.threebyrd.com':new URL(baseUrl).hostname!=='localhost'&&baseUrl!=='https://threebyrd-weekly-staging.thorbwag.workers.dev')throw new Error('This adapter is restricted to the local sandbox.');
 const stripe=stripeClient??new Stripe(key);
 return {
  environment:live?'stripe_live':'stripe_test',
  async checkout(purchase){
   const params=weeklyPaymentParams(baseUrl,purchase,taxCode);
   const now=Math.floor(Date.now()/1000);
   const expiry=Math.min(Math.floor(Date.parse(purchase.cutoffAt)/1000),now+23*60*60);
   if(expiry<now+31*60)throw new Error('Too close to cutoff for a new test Checkout session.');
   params.expires_at=expiry;
   const customer=await stripe.customers.retrieve(purchase.stripeCustomerId);
   if(customer.deleted||customer.livemode!==live)throw new Error('Only test customers are allowed.');
   await stripe.customers.update(purchase.stripeCustomerId,{name:purchase.recipientName,address:{line1:purchase.address.streetAddress,city:purchase.address.city,state:purchase.address.state,postal_code:purchase.address.zipCode,country:'US'}});
   const session=await stripe.checkout.sessions.create(params,{idempotencyKey:`weekly-first-payment:${purchase.id}`});
   if(session.livemode!==live||!session.url)throw new Error('Unexpected checkout environment.');
   return {id:session.id,url:session.url};
  },
  async reconcile(payload,signature,lookupPurchase){
   const event=await stripe.webhooks.constructEventAsync(payload,signature,webhookSecret);
   if(event.livemode!==live)throw new Error('Live events are forbidden.');
   if(event.type!=='checkout.session.completed')return null;
   const session=await stripe.checkout.sessions.retrieve(event.data.object.id);
   if(session.livemode!==live||session.mode!=='payment'||session.status!=='complete'||session.payment_status!=='paid'||session.currency!=='usd'||session.automatic_tax?.status!=='complete'||typeof session.payment_intent!=='string')throw new Error('Payment is incomplete or has the wrong environment.');
   const purchase=await lookupPurchase(session.id);
   if(!purchase||session.customer!==purchase.stripeCustomerId||session.metadata?.weekly_purchase_id!==purchase.id||session.metadata?.weekly_plan_id!==purchase.planId||session.metadata?.weekly_customer_id!==purchase.customerId||session.metadata?.weekly_cycle_id!==purchase.cycleId)throw new Error('Purchase ownership mismatch.');
   const tax=session.total_details?.amount_tax;
   if(!Number.isSafeInteger(tax)||tax<0||session.amount_subtotal!==purchase.quote.subtotalBeforeTaxCents||session.amount_total!==session.amount_subtotal+tax||(session.total_details?.amount_discount??0)!==0||(session.total_details?.amount_shipping??0)!==0)throw new Error('Payment amount does not match the approved order.');
   const intent=await stripe.paymentIntents.retrieve(session.payment_intent);
   if(intent.livemode!==live||intent.status!=='succeeded'||intent.customer!==purchase.stripeCustomerId||intent.amount_received!==session.amount_total||intent.amount!==session.amount_total||intent.currency!=='usd'||intent.setup_future_usage!=='off_session'||typeof intent.payment_method!=='string'||intent.metadata?.weekly_purchase_id!==purchase.id)throw new Error('Payment or saved-card reconciliation failed.');
   const method=await stripe.paymentMethods.retrieve(intent.payment_method);
   if(method.livemode!==live||method.customer!==purchase.stripeCustomerId)throw new Error('Saved payment method ownership mismatch.');
   return {eventId:event.id,purchaseId:purchase.id,sessionId:session.id,paymentIntentId:intent.id,paymentMethodId:method.id,customerId:purchase.customerId,cycleId:purchase.cycleId,totalCents:session.amount_total,taxCents:tax,environment:live?'stripe_live':'stripe_test'};
  },
 };
}
