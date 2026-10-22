import Stripe from 'stripe';
import { weeklySetupParams } from './stripe-setup.ts';
import { randomUUID } from 'node:crypto';
import { Problem } from './store-core.mjs';

export function createLivePayments(options){return stripePayments({...options,key:options.liveKey,live:true})}
export function createPayments({testKey,webhookSecret,baseUrl,stripeClient}){
 if(testKey)return stripePayments({key:testKey,webhookSecret,baseUrl,stripeClient,live:false});
 if(!testKey)return {environment:'mock',async customer(){return 'cus_mock_'+randomUUID()},async setup(){const id='cs_mock_'+randomUUID();return {id,url:`${baseUrl}/mock-card/${id}`}},webhookSecret:null};
}
function stripePayments({key,webhookSecret,baseUrl,stripeClient,live}){
 if(!(live?/^(sk|rk)_live_/:/^(sk|rk)_test_/).test(key)||!webhookSecret?.startsWith('whsec_'))throw new Error('Use separate WEEKLY_STRIPE_TEST_KEY and WEEKLY_STRIPE_TEST_WEBHOOK_SECRET. Live keys are forbidden.');
 if(live&&baseUrl!=='https://weekly.threebyrd.com')throw new Error('Unexpected production origin.');
 const stripe=stripeClient??new Stripe(key);
 return {
  environment:live?'stripe_live':'stripe_test',webhookSecret,
  async customer({email,customerId}){const c=await stripe.customers.create({email,metadata:{weekly_sandbox_customer:customerId}},{idempotencyKey:`weekly-stage2-customer:${customerId}`});return c.id},
  async setup({stripeCustomerId,planId,customerId}){
   const session=await stripe.checkout.sessions.create(weeklySetupParams(baseUrl,stripeCustomerId,planId,customerId));
   return {id:session.id,url:session.url};
  },
  async verifyWebhook(payload,signature){
   const event=await stripe.webhooks.constructEventAsync(payload,signature,webhookSecret);
   if(event.livemode!==live)throw new Problem(400,'Live events are forbidden in this sandbox.');
   if(event.type!=='checkout.session.completed')return null;
   const session=await stripe.checkout.sessions.retrieve(event.data.object.id);
   if(session.mode!=='setup'||session.livemode!==live||typeof session.setup_intent!=='string'||typeof session.customer!=='string')throw new Problem(400,'Unexpected setup session.');
   const setup=await stripe.setupIntents.retrieve(session.setup_intent);
   if(setup.status!=='succeeded'||setup.livemode!==live||setup.usage!=='off_session'||setup.customer!==session.customer||typeof setup.payment_method!=='string')throw new Problem(400,'Payment setup is incomplete or belongs to another customer.');
   const method=await stripe.paymentMethods.retrieve(setup.payment_method);
   if(method.customer!==session.customer||method.livemode!==live)throw new Problem(400,'Payment method ownership mismatch.');
   return {eventId:event.id,setupId:session.id,stripeCustomerId:session.customer,paymentMethodId:method.id,livemode:live,status:setup.status};
  },
 };
}
