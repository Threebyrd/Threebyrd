import {queueWeeklyEmail} from './email-outbox.mjs';
import { effectivePaidSnapshot } from './paid-edits.mjs';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { previewWeeklyPlan, applyPlanAction, changePlanCart } from '../plan.ts';
import { quoteWeeklyPlan } from '../quote.ts';
import { validateCalendar } from '../calendar.ts';
import { normalizeDeliveryAddressFields } from '../../delivery-address.ts';
import { normalizeRecipientName } from '../../recipient-name.ts';

export const DISCLOSURE_VERSION = 'weekly-stage3-v3';
export const DISCLOSURE = 'I authorize Three Byrd Meal Prep LLC (ThreeByrd Meal Prep) to save my payment method and simulate purchasing my first eligible delivery immediately and saving my card for subsequent eligible weekly cutoff charges. I receive 5% off paid quantity-tier meal prices (excluding sauce charges), regular sauce charges on paid meals, and one additional selected box of any size with an included sauce with my first successfully paid subscription delivery, once per verified customer. The free meal does not meet the three-paid-meal minimum or count toward pricing tiers. No other promotional discounts combine with this plan. Taxes apply and are not included in this preview subtotal. My meals repeat unless I change, skip, pause, or cancel before cutoff. This-and-future edits replace future meal overrides. After cutoff, paid orders require support assistance. Closed business weeks have no charge and automatically resume at the next open delivery. No minimum commitment. The first eligible delivery is purchased at signup; later eligible deliveries are charged at their cutoff. This sandbox can initiate Stripe test payments only, including scheduled test renewals; no live funds or real deliveries are involved; launch requires renewed authorization to final terms and pricing.';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
export class Problem extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(condition,message,status=400)=>{if(condition)throw new Problem(status,message)};
export function normalizeEmail(value){
 fail(typeof value!=='string'||value.length>254,'Enter a valid email address.');
 const email=value.trim().toLowerCase();fail(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email address.');return email;
}
function cartInput(value){
 fail(!Array.isArray(value)||value.length>30,'Choose a valid meal order.');
 return value.map(item=>{
  fail(!item||typeof item!=='object'||typeof item.productId!=='string'||!Number.isSafeInteger(item.quantity)||typeof item.sauceId!=='string','Invalid meal selection.');
  return {productId:item.productId,quantity:item.quantity,sauceId:item.sauceId};
 });
}
function welcomeInput(value){fail(!value||typeof value.productId!=='string'||typeof value.sauceId!=='string','Choose a free box and sauce.');return {productId:value.productId,sauceId:value.sauceId};}

export class WeeklyStore {
 constructor(database, {clock=()=>Date.now(), availability=()=>({}), environment='mock',authorization}={}){
  fail(!['mock','stripe_test','stripe_live'].includes(environment),'Invalid sandbox environment.');
  this.sql=database;this.clock=clock;this.availability=availability;this.environment=environment;this.disclosureVersion=authorization?.version??DISCLOSURE_VERSION;this.disclosure=authorization?.text??DISCLOSURE;
  fail(environment==='stripe_live'&&(!authorization?.version||!authorization?.text),'Production authorization is required.');
 }
 close(){this.sql.close()}
 transaction(fn){if(this.sql.transactionSync)return this.sql.transactionSync(fn);this.sql.exec('BEGIN IMMEDIATE');try{const result=fn();this.sql.exec('COMMIT');return result}catch(error){this.sql.exec('ROLLBACK');throw error}}
 calendar(){return this.sql.prepare('SELECT data FROM weekly_cycles ORDER BY sequence').all().map(row=>JSON.parse(row.data))}
 publish(calendar){
  validateCalendar(calendar);
  this.transaction(()=>{
   const old=this.calendar();const ids=new Set(calendar.map(c=>c.id));
   fail(old.some(c=>!ids.has(c.id)),'Referenced calendar history cannot be removed.');
   for(const cycle of calendar){
    const existing=old.find(c=>c.id===cycle.id);
    fail(existing&&existing.sequence!==cycle.sequence,'Cycle sequence is permanent.');
    fail(existing&&JSON.stringify(existing)!==JSON.stringify(cycle)&&this.sql.prepare('SELECT 1 FROM weekly_committed_orders WHERE cycle_id=?').get(cycle.id),'Committed cycles require separate support resolution.');
    this.sql.prepare('INSERT INTO weekly_cycles(id,sequence,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=weekly_cycles.revision+1').run(cycle.id,cycle.sequence,JSON.stringify(cycle));
    const revision=this.sql.prepare('SELECT revision FROM weekly_cycles WHERE id=?').get(cycle.id).revision;
    this.sql.prepare('INSERT INTO weekly_cycle_revisions VALUES(?,?,?,?,?)').run(randomUUID(),cycle.id,revision,JSON.stringify(cycle),this.clock());
   }
  });
 }
 rateLimit(key,limit=5){
  const now=this.clock();const k=hash(key);const row=this.sql.prepare('SELECT * FROM weekly_rate_limits WHERE key=?').get(k);
  if(!row||now-row.window_start>=900000){this.sql.prepare('INSERT INTO weekly_rate_limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1').run(k,now);return true}
  if(row.count>=limit)return false;this.sql.prepare('UPDATE weekly_rate_limits SET count=count+1 WHERE key=?').run(k);return true;
 }
 requestLink(email,ip){
  email=normalizeEmail(email);return this.transaction(()=>{
   const ipAllowed=this.rateLimit('ip:'+ip,20);const emailAllowed=this.rateLimit('email:'+email,5);if(!ipAllowed||!emailAllowed)return null;
   const raw=token();this.sql.prepare('INSERT INTO weekly_tokens VALUES(?,?,?,NULL)').run(hash(raw),email,this.clock()+900000);return {email,token:raw};
  });
 }
 verify(raw){
  fail(typeof raw!=='string'||raw.length>200,'This link is invalid or expired.',401);
  return this.transaction(()=>{
   const now=this.clock();const row=this.sql.prepare('UPDATE weekly_tokens SET consumed_at=? WHERE hash=? AND consumed_at IS NULL AND expires_at>? RETURNING email').get(now,hash(raw),now);
   fail(!row,'This link is invalid, expired, or already used. Request another.',401);
   this.sql.prepare('INSERT INTO weekly_customers VALUES(?,?,?) ON CONFLICT(email) DO NOTHING').run(randomUUID(),row.email,now);
   const customer=this.sql.prepare('SELECT * FROM weekly_customers WHERE email=?').get(row.email);
   const session=token(),csrf=token();this.sql.prepare('INSERT INTO weekly_sessions VALUES(?,?,?,?)').run(hash(session),customer.id,csrf,now+604800000);
   return {session,csrf,customer};
  });
 }
 authenticate(raw){
  if(typeof raw!=='string')return null;
  return this.sql.prepare('SELECT s.customer_id,s.csrf,c.email FROM weekly_sessions s JOIN weekly_customers c ON c.id=s.customer_id WHERE s.hash=? AND s.expires_at>?').get(hash(raw),this.clock())??null;
 }
 logout(raw){if(raw)this.sql.prepare('DELETE FROM weekly_sessions WHERE hash=?').run(hash(raw))}
 row(customerId){const row=this.sql.prepare('SELECT * FROM weekly_plans WHERE customer_id=?').get(customerId);return row?{...row,plan:JSON.parse(row.data),deliveryAddress:JSON.parse(row.address)}:null}
 ledger(){return this.sql.prepare('SELECT customer_id AS verifiedCustomerId,order_id AS orderId,cycle_id AS cycleId,redeemed_at AS redeemedAt FROM weekly_welcome_redemptions').all()}
 locks(customerId){return this.sql.prepare('SELECT cycle_id FROM weekly_committed_orders WHERE customer_id=? UNION SELECT cycle_id FROM weekly_test_recurring WHERE customer_id=?').all(customerId,customerId).map(row=>row.cycle_id)}
 preview(plan){return previewWeeklyPlan(plan,this.calendar(),this.ledger(),new Date(this.clock()),this.availability())}
 state(customerId){
  const row=this.row(customerId);if(!row)return {plan:null,calendar:this.calendar()};
  const committed=this.sql.prepare('SELECT id,cycle_id,snapshot FROM weekly_committed_orders WHERE customer_id=?').all(customerId).map(row=>({orderId:row.id,cycleId:row.cycle_id,snapshot:effectivePaidSnapshot(this,row.id,JSON.parse(row.snapshot))}));
  const preview=this.preview(row.plan);
  for(const decision of preview.cycles){const order=committed.find(o=>o.cycleId===decision.cycle.id);if(order){decision.status=this.sql.prepare('SELECT status FROM weekly_mock_payments WHERE id=(SELECT id FROM weekly_committed_orders WHERE customer_id=? AND cycle_id=?)').get(customerId,decision.cycle.id)?.status??'committed';decision.reason='Delivery purchased in the sandbox. Use the purchased-delivery controls to edit before cutoff.';decision.quote=order.snapshot.quote;}}
  for(const job of this.sql.prepare("SELECT j.cycle_id,j.status,r.job_id AS resolved FROM weekly_test_recurring j LEFT JOIN weekly_payment_resolutions r ON r.job_id=j.id WHERE j.customer_id=? AND j.status!='paid'").all(customerId)){
   const decision=preview.cycles.find(c=>c.cycle.id===job.cycle_id);
   if(decision&&!committed.some(o=>o.cycleId===job.cycle_id)){decision.status=job.resolved?'skipped':'payment_issue';decision.reason=job.resolved?'Unpaid delivery skipped; no charge or kitchen order.':'Payment is not confirmed. Update your card for future weeks or contact support.';}
  }
  preview.next=preview.cycles.find(c=>['ready','blocked'].includes(c.status))??null;
  return {plan:row.plan,address:row.deliveryAddress,recipientName:row.recipient_name,version:row.version,readiness:row.readiness,setupEnvironment:row.environment,paymentMethodSaved:!!row.payment_method_id,calendar:this.calendar(),preview,committedOrders:committed};
 }
 audit(customerId,action,version,plan){this.sql.prepare('INSERT INTO weekly_audit VALUES(?,?,?,?,?,?)').run(randomUUID(),customerId,action,version,this.clock(),JSON.stringify({plan,address:this.row(customerId)?.deliveryAddress,recipientName:this.row(customerId)?.recipient_name}))}
 enroll(customerId,body,checkedAddress){
  return this.transaction(()=>{
   const previous=this.row(customerId);fail(previous&&previous.plan.status!=='canceled','You already have a weekly plan. Manage it instead.',409);
   fail(body.authorized!==true||body.disclosureVersion!==this.disclosureVersion,'Please review and accept the weekly-plan authorization.');
   fail(body.promoCode!==undefined,'Other promotions cannot combine with weekly pricing.');
   const address=normalizeDeliveryAddressFields(checkedAddress);const name=normalizeRecipientName(body.recipientName);fail(!address||!name,'Enter your delivery name and a verified delivery address.');
   const plan={id:randomUUID(),verifiedCustomerId:customerId,enrolledAt:new Date(this.clock()).toISOString(),status:'active',resumeCycleId:null,defaultCart:cartInput(body.cart),overrides:{},skippedCycleIds:[],welcomeSelection:welcomeInput(body.welcome)};
   const preview=this.preview(plan);fail(!preview.next||preview.next.status!=='ready',preview.next?.reason??'No eligible delivery is published.');
   const version=(previous?.version??0)+1;
   this.sql.prepare(`INSERT INTO weekly_plans(customer_id,plan_id,data,address,recipient_name,version,readiness,environment) VALUES(?,?,?,?,?,?,'setup_pending',?) ON CONFLICT(customer_id) DO UPDATE SET plan_id=excluded.plan_id,data=excluded.data,address=excluded.address,recipient_name=excluded.recipient_name,version=excluded.version,readiness='setup_pending',latest_setup_id=NULL,payment_method_id=NULL,environment=excluded.environment`).run(customerId,plan.id,JSON.stringify(plan),JSON.stringify(address),name,version,this.environment);
   this.sql.prepare('INSERT INTO weekly_authorizations VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),customerId,plan.id,this.disclosureVersion,this.disclosure,this.clock(),this.environment,'sandbox_enrollment');
   this.audit(customerId,'enroll',version,plan);return this.state(customerId);
  });
 }
 mutate(customerId,body,checkedAddress){
  return this.transaction(()=>{
   const row=this.row(customerId);fail(!row,'No weekly plan found.',404);fail(!Number.isSafeInteger(body.version)||body.version!==row.version,'Your plan changed. Refresh and try again.',409);
   fail(row.plan.status==='canceled','Canceled plans require a new enrollment.',409);
   const calendar=this.calendar(),locks=this.locks(customerId),now=new Date(this.clock());let plan=row.plan;
   if(body.action==='cart'){
    fail(!['this_delivery','this_and_future'].includes(body.scope)||typeof body.cycleId!=='string','Choose which deliveries to update.');
    plan=changePlanCart(plan,calendar,body.cycleId,cartInput(body.cart),body.scope,now,locks,this.availability());
   }else if(body.action==='welcome'){
    fail(this.ledger().some(entry=>entry.verifiedCustomerId===customerId),'Welcome box already redeemed.');
    const next=this.preview(plan).next;fail(!next||locks.includes(next.cycle.id),'No editable welcome delivery.');
    const selection=welcomeInput(body.welcome);fail(!quoteWeeklyPlan(plan.defaultCart,selection,this.availability()).isValid,'Choose an available welcome meal.');plan={...plan,welcomeSelection:selection};
   }else if(body.action==='address'){
    fail(!normalizeDeliveryAddressFields(checkedAddress),'Verify your new delivery address.');
   }else{
    fail(!['skip','unskip','pause','resume','cancel'].includes(body.action),'Unknown plan action.');
    fail(['skip','unskip'].includes(body.action)&&typeof body.cycleId!=='string','Choose a delivery.');
    fail(body.action==='pause'&&body.resumeCycleId!==null&&typeof body.resumeCycleId!=='string','Choose a return delivery.');
    plan=applyPlanAction(plan,calendar,{type:body.action,cycleId:body.cycleId,resumeCycleId:body.resumeCycleId},now,locks);
   }
   const recipientName=body.action==='address'&&body.recipientName!==undefined?normalizeRecipientName(body.recipientName):row.recipient_name;
   fail(!recipientName,'Enter a valid delivery name.');
   const changes=this.sql.prepare('UPDATE weekly_plans SET data=?,address=?,recipient_name=?,version=version+1 WHERE customer_id=? AND version=?').run(JSON.stringify(plan),JSON.stringify(checkedAddress??row.deliveryAddress),recipientName,customerId,row.version).changes;
   fail(changes!==1,'Your plan changed. Refresh and try again.',409);this.audit(customerId,body.action,row.version+1,plan);
   const emailKinds={skip:'skipped',pause:'paused',cancel:'canceled',resume:'resumed',cart:'plan_updated',address:'plan_updated',welcome:'plan_updated',unskip:'plan_updated'};
   if(emailKinds[body.action])queueWeeklyEmail(this,{id:`plan:${plan.id}:${row.version+1}`,customerId,kind:emailKinds[body.action],details:{name:recipientName,deliveryDate:calendar.find(c=>c.id===body.cycleId)?.deliveryDate}});
   return this.state(customerId);
  });
 }
 mapping(customerId){return this.sql.prepare('SELECT stripe_customer_id FROM weekly_customer_mappings WHERE customer_id=? AND environment=?').get(customerId,this.environment)?.stripe_customer_id}
 saveMapping(customerId,stripeId){this.sql.prepare('INSERT INTO weekly_customer_mappings VALUES(?,?,?) ON CONFLICT(customer_id,environment) DO NOTHING').run(customerId,this.environment,stripeId);return this.mapping(customerId)}
 startSetup(customerId,id,stripeCustomerId,planId){
  this.transaction(()=>{const row=this.row(customerId);fail(!row||row.plan.id!==planId||row.plan.status==='canceled','Plan no longer available.',409);
   this.sql.prepare('INSERT INTO weekly_setup_attempts(id,customer_id,stripe_customer_id,plan_id,environment,created_at) VALUES(?,?,?,?,?,?)').run(id,customerId,stripeCustomerId,planId,this.environment,this.clock());
   this.sql.prepare('UPDATE weekly_plans SET latest_setup_id=? WHERE customer_id=?').run(id,customerId);
  });
 }
 completeSetup({eventId,setupId,stripeCustomerId,paymentMethodId,livemode,status}){
  fail(livemode!==(this.environment==='stripe_live')||status!=='succeeded'||typeof paymentMethodId!=='string'||!paymentMethodId,'Only successful test-mode setup can be accepted.');
  return this.transaction(()=>{
   if(this.sql.prepare('SELECT 1 FROM weekly_events WHERE id=?').get(eventId))return {duplicate:true};
   const attempt=this.sql.prepare('SELECT * FROM weekly_setup_attempts WHERE id=? AND environment=?').get(setupId,this.environment);
   fail(!attempt||attempt.stripe_customer_id!==stripeCustomerId,'Setup ownership mismatch.',403);
   const row=this.row(attempt.customer_id);fail(!row||row.plan_id!==attempt.plan_id,'Setup belongs to an old enrollment.',409);
   this.sql.prepare('UPDATE weekly_setup_attempts SET status=? WHERE id=?').run('succeeded',setupId);
   this.sql.prepare('INSERT INTO weekly_events VALUES(?,?,?)').run(eventId,this.clock(),this.environment);
   if(row.latest_setup_id===setupId&&row.plan.status!=='canceled'){
    this.sql.prepare("UPDATE weekly_plans SET readiness='staged_ready',payment_method_id=?,version=version+1 WHERE customer_id=?").run(paymentMethodId,attempt.customer_id);
    this.audit(attempt.customer_id,'test_payment_method_saved',row.version+1,row.plan);
   }
   return {staged:true};
  });
 }
}
