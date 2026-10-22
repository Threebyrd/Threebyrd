import test from 'node:test';
import assert from 'node:assert/strict';
import {WeeklyStore} from '../app/subscriptions/sandbox/store.mjs';
import {queueWeeklyEmail,drainWeeklyEmails} from '../app/subscriptions/sandbox/email-outbox.mjs';
function fixture(email='luc@threebyrd.com'){
 const store=new WeeklyStore(':memory:');const customer=store.verify(store.requestLink(email,'test').token).customer;
 const enqueue=(id='receipt:1')=>queueWeeklyEmail(store,{id,customerId:customer.id,kind:'receipt',details:{name:'Test',deliveryDate:'2026-10-31',totalCents:3402}});
 return {store,enqueue};
}
test('durable notification is atomic, deduplicated, and delivered once with safe management entry',async()=>{
 const {store,enqueue}=fixture();try{
 assert.throws(()=>store.transaction(()=>{enqueue();throw new Error('rollback')}));
 assert.equal(store.sql.prepare('SELECT count(*) n FROM weekly_email_outbox').get().n,0);
 store.transaction(()=>{enqueue();enqueue()});let sends=0;
 const send=async message=>{sends++;assert.deepEqual(message.to,['luc@threebyrd.com']);assert.match(message.text,/http:\/\/localhost:3012\/my-plan/);assert.doesNotMatch(message.text,/no email has been sent/);return {messageId:'test-1'}};
 await drainWeeklyEmails(store,{send,baseUrl:'http://localhost:3012'});await drainWeeklyEmails(store,{send,baseUrl:'http://localhost:3012'});assert.equal(sends,1);
 }finally{store.close()}
});
test('test queue never redirects customer mail and never retries uncertain sends',async()=>{
 const a=fixture('customer@example.com');try{a.enqueue();await drainWeeklyEmails(a.store,{baseUrl:'http://localhost:3012',send:()=>{throw new Error('must not send')}});assert.equal(a.store.sql.prepare('SELECT status FROM weekly_email_outbox').get().status,'blocked_recipient')}finally{a.store.close()}
 const b=fixture();try{b.enqueue();let count=0;const opts={baseUrl:'http://localhost:3012',send:async()=>{count++;throw new Error('timeout')}};await drainWeeklyEmails(b.store,opts);await drainWeeklyEmails(b.store,opts);assert.equal(count,1);assert.equal(b.store.sql.prepare('SELECT status FROM weekly_email_outbox').get().status,'review_required');await assert.rejects(drainWeeklyEmails(b.store,{...opts,baseUrl:'https://other.example'}));}finally{b.store.close()}
});

test('upcoming notices use the published cutoff, deduplicate and suppress stale reminders',async()=>{
 const {sampleCalendar}=await import('../scripts/weekly-sandbox/server.mjs');
 const {DISCLOSURE_VERSION}=await import('../app/subscriptions/sandbox/store.mjs');
 const {queueUpcomingNotices}=await import('../app/subscriptions/sandbox/email-outbox.mjs');
 let now=Date.parse('2026-10-29T20:00:00Z');const store=new WeeklyStore(':memory:',{clock:()=>now});
 try{
 store.publish(sampleCalendar());const customer=store.verify(store.requestLink('luc@threebyrd.com','test').token).customer;
 store.enroll(customer.id,{cart:[{productId:'big-chicken',quantity:3,sauceId:'bbq'}],welcome:{productId:'big-beef',sauceId:'bbq'},recipientName:'Test',authorized:true,disclosureVersion:DISCLOSURE_VERSION},{streetAddress:'123 State St',city:'Ithaca',state:'NY',zipCode:'14850'});
 store.sql.prepare("UPDATE weekly_plans SET readiness='staged_ready',payment_method_id='pm_mock' WHERE customer_id=?").run(customer.id);
 queueUpcomingNotices(store);queueUpcomingNotices(store);assert.equal(store.sql.prepare('SELECT count(*) n FROM weekly_email_outbox').get().n,1);
 store.mutate(customer.id,{action:'pause',resumeCycleId:null,version:store.row(customer.id).version});
 const sent=[];await drainWeeklyEmails(store,{baseUrl:'http://localhost:3012',send:async m=>{sent.push(m.subject);return {messageId:'test'}}});
 assert.deepEqual(sent,['[SANDBOX TEST] Your ThreeByrd plan is paused']);
 assert.equal(store.sql.prepare("SELECT status FROM weekly_email_outbox WHERE kind='cutoff_reminder'").get().status,'review_required');
 now=Date.parse('2026-10-30T20:00:00Z');queueUpcomingNotices(store);assert.equal(store.sql.prepare("SELECT count(*) n FROM weekly_email_outbox WHERE kind='cutoff_reminder'").get().n,1);
 }finally{store.close()}
});
