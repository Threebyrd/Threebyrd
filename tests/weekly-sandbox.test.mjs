import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Stripe from 'stripe';
import { WeeklyStore,DISCLOSURE_VERSION,hash } from '../app/subscriptions/sandbox/store.mjs';
import { createSandboxService } from '../app/subscriptions/sandbox/service.mjs';
import { createPayments } from '../app/subscriptions/sandbox/payments.mjs';
import { sampleCalendar } from '../scripts/weekly-sandbox/server.mjs';

const baseUrl='http://localhost:3012';
const goodAddress={streetAddress:'123 State St',city:'Ithaca',state:'NY',zipCode:'14850'};
const cart=[{productId:'big-chicken',quantity:5,sauceId:'bbq'}];
const enrollment={cart,welcome:{productId:'little-beef',sauceId:'franks-redhot'},address:goodAddress,recipientName:'Test Person',authorized:true,disclosureVersion:DISCLOSURE_VERSION};
function fixture(options={}){
 let now=Date.parse('2026-10-21T17:00:00Z');const store=new WeeklyStore(':memory:',{clock:()=>now,...options});store.publish(sampleCalendar());
 const payments=createPayments({baseUrl});
 const service=createSandboxService({store,payments,baseUrl,devKey:'private-dev-key',staticRoot:new URL('../scripts/weekly-sandbox/',import.meta.url),assetRoot:new URL('../public/',import.meta.url),checkAddress:async a=>{if(a.city!=='Ithaca')throw new Error('Outside test delivery area')}});
 const request=(path,data,session,headers={})=>service.fetch(new Request(baseUrl+path,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json',origin:baseUrl}:{}),...(session?{cookie:'weekly_sandbox='+session.session,'x-csrf-token':session.csrf}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})}));
 const user=(email='test@example.com')=>{const link=store.requestLink(email,'test');return store.verify(link.token)};
 return {store,service,request,user,setTime:value=>{now=Date.parse(value)}};
}

test('magic links are hashed, single-use, expire, and create verified identity without legacy matching',()=>{
 const f=fixture();try{
  const link=f.store.requestLink('Test@Example.com','a');
  const row=f.store.sql.prepare('SELECT * FROM weekly_tokens').get();assert.equal(row.hash,hash(link.token));assert.notEqual(row.hash,link.token);
  const verified=f.store.verify(link.token);assert.equal(verified.customer.email,'test@example.com');
  assert.throws(()=>f.store.verify(link.token),/already used/);
  const next=f.store.requestLink('test@example.com','a');assert.equal(f.store.verify(next.token).customer.id,verified.customer.id);
  const expired=f.store.requestLink('expired@example.com','a');f.setTime('2026-10-21T17:15:00Z');assert.throws(()=>f.store.verify(expired.token),/expired/);
  assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_customers').get().n,1);
 }finally{f.store.close()}
});

test('login responses do not reveal account existence and throttle requests',async()=>{
 const f=fixture();try{
  f.user('known@example.com');
  const a=await f.request('/api/login',{email:'known@example.com'}),b=await f.request('/api/login',{email:'unknown@example.com'});
  assert.deepEqual(await a.json(),await b.json());
  for(let i=0;i<10;i++)assert.equal((await f.request('/api/login',{email:'unknown@example.com'})).status,200);
  assert.equal(f.service.mailbox.filter(m=>m.email==='unknown@example.com').length,5);
  const hidden=await f.request('/api/dev-inbox');assert.equal(hidden.status,403);
 }finally{f.store.close()}
});

test('sessions expire, logout invalidates, and session cookie has security attributes',async()=>{
 const f=fixture();try{
  const link=f.store.requestLink('cookie@example.com','a');
  const verified=await f.request('/api/verify',{token:link.token});assert.equal(verified.status,200);
  assert.match(verified.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  const raw=verified.headers.get('set-cookie').split(';')[0].split('=')[1];assert.ok(f.store.authenticate(raw));
  f.setTime('2026-10-29T17:00:00Z');assert.equal(f.store.authenticate(raw),null);
  const session=f.user();f.store.logout(session.session);assert.equal(f.store.authenticate(session.session),null);
 }finally{f.store.close()}
});

test('same-origin plus CSRF required and identities cannot access other plans',async()=>{
 const f=fixture();try{
  const a=f.user('a@example.com'),b=f.user('b@example.com');
  assert.equal((await f.request('/api/enroll',enrollment,a,{origin:'https://evil.test'})).status,403);
  assert.equal((await f.request('/api/enroll',enrollment,a,{'x-csrf-token':'wrong'})).status,403);
  assert.equal((await f.request('/api/enroll',enrollment)).status,401);
  assert.equal((await f.request('/api/enroll',enrollment,a)).status,200);
  const other=await(await f.request('/api/me',null,b)).json();assert.equal(other.plan,null);assert.equal(other.address,undefined);
  assert.equal((await f.request('/api/plan',{action:'cancel',customerId:a.customer.id,version:1},b)).status,404);
 }finally{f.store.close()}
});

test('signup persists exact authorization and is staged without charges or welcome redemption',async()=>{
 const f=fixture();try{
  const session=f.user();assert.equal((await f.request('/api/enroll',{...enrollment,authorized:false},session)).status,400);
  assert.equal((await f.request('/api/enroll',{...enrollment,promoCode:'STACK'},session)).status,400);
  const response=await f.request('/api/enroll',enrollment,session);assert.equal(response.status,200);const state=await response.json();
  assert.equal(state.readiness,'setup_pending');assert.equal(state.preview.next.quote.subtotalBeforeTaxCents,4775);
  assert.equal(state.preview.next.quote.fulfillmentMealCount,6);
  assert.equal(f.store.ledger().length,0);
  assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_committed_orders').get().n,0);
  const auth=f.store.sql.prepare('SELECT * FROM weekly_authorizations').get();assert.equal(auth.disclosure_version,DISCLOSURE_VERSION);assert.match(auth.disclosure_text,/launch requires renewed authorization/);
  assert.equal((await f.request('/api/enroll',enrollment,session)).status,409);
 }finally{f.store.close()}
});

test('mock setup failures and redirects never mark a card saved; success is scoped and idempotent',async()=>{
 const f=fixture();try{
  const session=f.user(),other=f.user('other@example.com');f.store.enroll(session.customer.id,enrollment,goodAddress);
  const setup=await(await f.request('/api/setup',{},session)).json();const setupId=setup.url.split('/').pop();
  assert.equal((await f.request('/api/mock-setup',{setupId,outcome:'success'},other)).status,404);
  assert.equal((await f.request('/api/mock-setup',{setupId,outcome:'failed'},session)).status,200);
  assert.equal(f.store.state(session.customer.id).paymentMethodSaved,false);
  await f.request('/my-plan?setup=returned',null,session);assert.equal(f.store.state(session.customer.id).readiness,'setup_pending');
  assert.equal((await f.request('/api/mock-setup',{setupId,outcome:'success'},session)).status,200);
  const state=f.store.state(session.customer.id);assert.equal(state.readiness,'staged_ready');assert.equal(state.paymentMethodSaved,true);
  await f.request('/api/mock-setup',{setupId,outcome:'success'},session);assert.equal(f.store.state(session.customer.id).version,state.version);
  assert.equal(f.store.ledger().length,1);
  assert.equal(f.store.state(session.customer.id).committedOrders.length,1);
 }finally{f.store.close()}
});

test('concurrent edits use optimistic versions and preserve an audit trail',async()=>{
 const f=fixture();try{
  const session=f.user();f.store.enroll(session.customer.id,enrollment,goodAddress);
  const results=await Promise.all([f.request('/api/plan',{action:'skip',cycleId:'review-44',version:1},session),f.request('/api/plan',{action:'pause',resumeCycleId:null,version:1},session)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(f.store.row(session.customer.id).version,2);
  assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_audit').get().n,2);
 }finally{f.store.close()}
});

test('customer actions persist cart scope, skip, pause, return, address and cancellation',()=>{
 const f=fixture();try{
  const session=f.user(),id=session.customer.id;f.store.enroll(id,enrollment,goodAddress);
  const change=body=>f.store.mutate(id,{...body,version:f.store.row(id).version});
  change({action:'cart',cycleId:'review-44',scope:'this_delivery',cart:[{productId:'big-beef',quantity:3,sauceId:'bbq'}]});
  assert.equal(f.store.state(id).preview.next.quote.paidLines[0].name,'Big Beef');assert.equal(f.store.row(id).plan.defaultCart[0].productId,'big-chicken');
  change({action:'cart',cycleId:'review-44',scope:'this_and_future',cart:[{productId:'little-chicken',quantity:4,sauceId:'no-sauce'}]});
  assert.equal(f.store.row(id).plan.defaultCart[0].productId,'little-chicken');
  change({action:'skip',cycleId:'review-44'});assert.equal(f.store.state(id).preview.next.cycle.id,'review-45');
  change({action:'pause',resumeCycleId:'review-48'});assert.equal(f.store.state(id).preview.next.cycle.id,'review-49');
  change({action:'pause',resumeCycleId:null});assert.equal(f.store.state(id).preview.next,null);
  change({action:'resume'});assert.equal(f.store.state(id).preview.next.cycle.id,'review-45');
  f.store.mutate(id,{action:'address',version:f.store.row(id).version},{...goodAddress,streetAddress:'456 State St'});
  assert.equal(f.store.state(id).address.streetAddress,'456 State St');
  change({action:'cancel'});assert.equal(f.store.state(id).plan.status,'canceled');
  assert.equal(f.store.ledger().length,0);
 }finally{f.store.close()}
});

test('server revalidates address, availability, cutoff, and stable calendar locks',async()=>{
 let unavailable={};const f=fixture({availability:()=>unavailable});try{
  const session=f.user();assert.equal((await f.request('/api/enroll',{...enrollment,address:{...goodAddress,city:'Elsewhere'}},session)).status,400);
  f.store.enroll(session.customer.id,enrollment,goodAddress);
  unavailable={unavailableProductIds:['big-beef']};
  assert.throws(()=>f.store.mutate(session.customer.id,{action:'cart',cycleId:'review-44',scope:'this_delivery',version:1,cart:[{productId:'big-beef',quantity:3,sauceId:'bbq'}]}),/unavailable/);
  f.setTime('2026-10-30T19:00:00Z');
  assert.throws(()=>f.store.mutate(session.customer.id,{action:'skip',cycleId:'review-44',version:1}),/cutoff/);
  const snapshot=JSON.stringify({cart,amountCents:4775,deliveryDate:'2026-10-31'});
  f.store.sql.prepare('INSERT INTO weekly_committed_orders VALUES(?,?,?,?)').run('paid',session.customer.id,'review-44',snapshot);
  assert.throws(()=>f.store.publish(f.store.calendar().map(c=>c.id==='review-44'?{...c,deliveryDate:'2026-11-01'}:c)),/Committed/);
  assert.throws(()=>f.store.sql.prepare('UPDATE weekly_committed_orders SET snapshot=?').run('{}'),/immutable/);
  assert.throws(()=>f.store.sql.prepare('DELETE FROM weekly_committed_orders').run(),/audit/);
 }finally{f.store.close()}
});

test('cancel/rejoin retains verified identity and redeemed welcome eligibility',()=>{
 const f=fixture();try{
  const session=f.user(),id=session.customer.id;f.store.enroll(id,enrollment,goodAddress);
  f.store.sql.prepare('INSERT INTO weekly_welcome_redemptions VALUES(?,?,?,?)').run(id,'previous-paid-order','previous-cycle','2026-10-20T17:00:00Z');
  f.store.mutate(id,{action:'cancel',version:1});f.store.enroll(id,enrollment,goodAddress);
  assert.equal(f.store.state(id).preview.welcomeEligible,false);assert.equal(f.store.state(id).preview.next.quote.freeMealCount,0);
  assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_authorizations').get().n,2);
 }finally{f.store.close()}
});

test('saved setup validates mode, ownership, canceled and superseded attempts',()=>{
 const f=fixture();try{
  const session=f.user(),id=session.customer.id;f.store.enroll(id,enrollment,goodAddress);
  f.store.startSetup(id,'setup-old','cus-test',f.store.row(id).plan.id);f.store.startSetup(id,'setup-new','cus-test',f.store.row(id).plan.id);
  const event={eventId:'event',setupId:'setup-old',stripeCustomerId:'cus-test',paymentMethodId:'pm-test',livemode:false,status:'succeeded'};
  assert.throws(()=>f.store.completeSetup({...event,livemode:true}),/test-mode/);
  assert.throws(()=>f.store.completeSetup({...event,stripeCustomerId:'someone-else'}),/ownership/);
  f.store.completeSetup(event);assert.equal(f.store.state(id).paymentMethodSaved,false);
  f.store.mutate(id,{action:'cancel',version:1});f.store.completeSetup({...event,eventId:'event2',setupId:'setup-new'});assert.equal(f.store.state(id).paymentMethodSaved,false);
 }finally{f.store.close()}
});

test('sandbox persistence survives restart with no production schema',()=>{
 const dir=mkdtempSync(join(tmpdir(),'weekly-stage2-'));const path=join(dir,'test.sqlite');let store;
 try{store=new WeeklyStore(path);const link=store.requestLink('persist@example.com','a');const verified=store.verify(link.token);store.close();store=new WeeklyStore(path);assert.ok(store.authenticate(verified.session));assert.equal(store.sql.prepare("SELECT count(*) n FROM sqlite_master WHERE name='orders'").get().n,0)}finally{store?.close();rmSync(dir,{recursive:true,force:true})}
});

test('Stripe adapter uses setup mode, stable customer idempotency and verifies signed ownership',async()=>{
 const calls=[];const secret='whsec_weekly_test_fixture';
 const stripeForSignature=new Stripe('sk_test_fixture_only');
 const event={id:'evt_fixture',livemode:false,type:'checkout.session.completed',data:{object:{id:'cs_fixture'}}};
 const client={
  customers:{create:async(args,options)=>{calls.push({args,options});return {id:'cus_fixture'}}},
  checkout:{sessions:{create:async args=>{calls.push(args);return {id:'cs_fixture',url:'https://checkout.stripe.com/test'}},retrieve:async()=>({mode:'setup',livemode:false,setup_intent:'seti_fixture',customer:'cus_fixture'})}},
  setupIntents:{retrieve:async()=>({status:'succeeded',livemode:false,usage:'off_session',customer:'cus_fixture',payment_method:'pm_fixture'})},
  paymentMethods:{retrieve:async()=>({id:'pm_fixture',customer:'cus_fixture',livemode:false})},
  webhooks:stripeForSignature.webhooks,
 };
 const payments=createPayments({baseUrl,testKey:'sk_test_fixture_only',webhookSecret:secret,stripeClient:client});
 await payments.customer({email:'verified@example.com',customerId:'verified-id'});assert.equal(calls[0].options.idempotencyKey,'weekly-stage2-customer:verified-id');
 await payments.setup({stripeCustomerId:'cus_fixture',planId:'plan',customerId:'verified-id'});
 assert.equal(calls[1].mode,'setup');assert.equal(calls[1].setup_intent_data.metadata.weekly_plan_id,'plan');assert.equal(calls[1].line_items,undefined);
 const payload=JSON.stringify(event);const signature=stripeForSignature.webhooks.generateTestHeaderString({payload,secret});
 assert.equal((await payments.verifyWebhook(payload,signature)).paymentMethodId,'pm_fixture');
 await assert.rejects(()=>payments.verifyWebhook(payload,'invalid'));
 client.paymentMethods.retrieve=async()=>({id:'pm_fixture',customer:'wrong',livemode:false});await assert.rejects(()=>payments.verifyWebhook(payload,signature),/ownership/);
 assert.throws(()=>createPayments({baseUrl,testKey:'sk_live_forbidden',webhookSecret:secret}),/Live keys/);
});

test('one-time sandbox checkout retains ordinary pricing and creates no order',async()=>{
 const f=fixture();try{
  const quote=await(await f.request('/api/quote',{cart})).json();assert.equal(quote.quote.subtotalBeforeTaxCents,4775);
  const delivery=await f.request('/api/delivery-eligibility',{address:goodAddress});assert.equal(delivery.status,200);
  const empty=await f.request('/api/checkout',{items:[],recipientName:'Test',deliveryAddress:goodAddress});assert.equal(empty.status,400);
  const checkout=await f.request('/api/checkout',{items:cart,recipientName:'Test',deliveryAddress:goodAddress});assert.equal(checkout.status,200);assert.match((await checkout.json()).url,/one-time-preview/);
  assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_committed_orders').get().n,0);
  assert.equal(f.store.sql.prepare('SELECT count(*) n FROM weekly_plans').get().n,0);
 }finally{f.store.close()}
});

test('old weekly-plan links redirect to the current website instead of the earlier builder',async()=>{
 const f=fixture();try{
  const response=await f.request('/weekly-plan');assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/?plan=weekly#order');assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await f.request('/weekly-signup')).status,200);
 }finally{f.store.close()}
});

test('operator visibility requires the private developer key, not a customer session',async()=>{
 const f=fixture();try{
  const customer=f.user();
  assert.equal((await f.request('/api/dev-operations',null,customer)).status,403);
  const response=await f.request('/api/dev-operations',null,null,{authorization:'Bearer private-dev-key'});
  assert.equal(response.status,200);assert.equal((await response.json()).orders.length,0);
 }finally{f.store.close()}
});

test('paid edit routes require ownership and CSRF and return the effective revised purchase',async()=>{
 const f=fixture();try{
  const session=f.user();await f.request('/api/enroll',enrollment,session);
  const setup=await(await f.request('/api/setup',{},session)).json();
  await f.request('/api/mock-setup',{setupId:setup.url.split('/').pop(),outcome:'success'},session);
  const order=f.store.state(session.customer.id).committedOrders[0];
  const body={orderId:order.orderId,cart:[{productId:'big-beef',quantity:5,sauceId:'bbq'}]};
  assert.equal((await f.request('/api/paid-edit/preview',body,session,{'x-csrf-token':'wrong'})).status,403);
  const other=f.user('other@example.test');assert.equal((await f.request('/api/paid-edit/preview',body,other)).status,404);
  const preview=await(await f.request('/api/paid-edit/preview',body,session)).json();
  assert.equal((await f.request('/api/paid-edit/save',{...body,revision:preview.revision,approvedDeltaCents:preview.deltaCents,requestId:'route_request_001',outcome:'paid'},session)).status,200);
  const state=await(await f.request('/api/me',null,session)).json();
  assert.equal(state.committedOrders[0].snapshot.quote.paidLines[0].productId,'big-beef');
  assert.equal(state.plan.defaultCart[0].productId,'big-chicken');
 }finally{f.store.close()}
});
