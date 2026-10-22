import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteWeeklyPlan} from '../app/subscriptions/quote.ts';
import {weeklySheetPreview,STAGING_WEEKLY_SHEET_ID} from '../app/subscriptions/sandbox/sheet-preview.mjs';
const order={environment:'mock',paymentStatus:'paid',orderId:'local-test',planId:'test-plan',recipientName:'Fictional Customer',address:{streetAddress:'123 State St',city:'Ithaca',state:'NY',zipCode:'14850'},cycle:{deliveryDate:'2026-10-31'},quote:quoteWeeklyPlan([{productId:'big-chicken',quantity:3,sauceId:'bbq'}],{productId:'big-beef',sauceId:'bbq'}),taxCents:0,totalCents:3150};
test('staging mapping counts free boxes in kitchen totals without adding a paid meal or invented Stripe session',()=>{
 const p=weeklySheetPreview(order);assert.equal(p.destination.spreadsheetId,STAGING_WEEKLY_SHEET_ID);assert.equal(p.localPreviewOnly,true);
 assert.equal(p.columns['Big Chicken Qty'],3);assert.equal(p.columns['Big Beef Qty'],1);assert.equal(p.columns['Total Meals'],4);assert.equal(p.columns['Total Paid'],31.5);assert.equal(p.columns['Stripe Session ID'],'');assert.match(p.columns['Meal Breakdown'],/FREE WELCOME BOX/);
});
test('staging mapping rejects unpaid, live and unreconciled records',()=>{
 assert.throws(()=>weeklySheetPreview({...order,paymentStatus:'failed'}));assert.throws(()=>weeklySheetPreview({...order,environment:'live'}));assert.throws(()=>weeklySheetPreview({...order,totalCents:1}));
});
