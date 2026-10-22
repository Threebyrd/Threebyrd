import test from 'node:test';import assert from 'node:assert/strict';
import {weeklyEmailPreview} from '../app/subscriptions/sandbox/email-preview.mjs';
test('weekly email previews are limited to the approved test recipient and do not claim delivery',()=>{
 for(const kind of ['receipt','cutoff_reminder','payment_failed','order_changed','skipped','paused','canceled','holiday']){
 const message=weeklyEmailPreview(kind,{name:'Fictional Customer',deliveryDate:'2026-11-08',cutoff:'Friday at 3 PM ET',totalCents:3402,to:'other@example.test'});assert.equal(message.to,'luc@threebyrd.com');assert.equal(message.delivery,'preview_only');assert.match(message.text,/no email has been sent/);}
 assert.match(weeklyEmailPreview('payment_failed',{deliveryDate:'2026-11-08'}).text,/not confirmed for preparation/);
 assert.throws(()=>weeklyEmailPreview('receipt',{manageUrl:'https://untrusted.example/my-plan'}));
});
