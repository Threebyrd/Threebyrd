import test from 'node:test';import assert from 'node:assert/strict';
import {buildVerifiedTestSheetOrder,sendVerifiedTestOrders} from '../app/subscriptions/sandbox/test-sheet-sync.mjs';
import {quoteWeeklyPlan} from '../app/subscriptions/quote.ts';
const order={environment:'stripe_test',paymentStatus:'paid',sessionId:'cs_test_real',orderId:'test-id',planId:'test-plan',recipientName:'Fictional Test',address:{streetAddress:'123 State St',city:'Ithaca',state:'NY',zipCode:'14850'},cycle:{deliveryDate:'2026-11-08'},quote:quoteWeeklyPlan([{productId:'big-chicken',quantity:3,sauceId:'bbq'}],{productId:'big-beef',sauceId:'bbq'}),taxCents:252,totalCents:3402};
test('verified Stripe test export preserves Sunday delivery, free physical box and reconciled tax',()=>{
 const p=buildVerifiedTestSheetOrder(order,'test@example.test',Date.now());assert.equal(p.deliveryDate,'2026-11-08');assert.equal(p.totalMeals,4);assert.equal(p.bigBeefQty,1);assert.equal(p.totalPaid,34.02);assert.equal(p.mealSubtotal-p.discount+p.salesTax,p.totalPaid);assert.equal(p.stripeSessionId,'cs_test_real');assert.match(p.notes,/no delivery/);
 assert.throws(()=>buildVerifiedTestSheetOrder({...order,environment:'mock'},'test@example.test',Date.now()));
});
test('test export refuses an unverified destination before making a request',async()=>{
 let calls=0;await assert.rejects(()=>sendVerifiedTestOrders({environment:'stripe_test'},{spreadsheetId:'production',secret:'fixture',url:'https://script.google.com/macros/s/test/exec'},{fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
});
test('recurring test export carries the actual PaymentIntent without inventing a Checkout Session',()=>{
 const recurring={...order,sessionId:undefined,paymentIntentId:'pi_recurringTest123',taxTransactionId:'tax_test'};
 const p=buildVerifiedTestSheetOrder(recurring,'test@example.test',Date.now());assert.equal(p.stripeSessionId,undefined);assert.equal(p.stripePaymentIntentId,'pi_recurringTest123');assert.match(p.notes,/PaymentIntent/);
 assert.throws(()=>buildVerifiedTestSheetOrder({...recurring,taxTransactionId:null},'test@example.test',Date.now()));
});
