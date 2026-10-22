import { STAGING_WEEKLY_SHEET_ID } from './sheet-preview.mjs';

export const PRODUCTION_WEEKLY_SHEET_ID='1NCVNbcIUnzH5nMhlxvu1qus2xPIOOC-JOx4rHqJ-Or8';
export function buildVerifiedTestSheetOrder(order,email,createdAt){return buildVerifiedSheetOrder(order,email,createdAt,false)}
export function buildVerifiedLiveSheetOrder(order,email,createdAt){return buildVerifiedSheetOrder(order,email,createdAt,true)}
function buildVerifiedSheetOrder(order,email,createdAt,live){
 const q=order.quote;
 if(order.environment!==(live?'stripe_live':'stripe_test')||order.paymentStatus!=='paid'||(!(live?/^cs_live_/:/^cs_test_/).test(order.sessionId??'')&&!(order.sessionId===undefined&&/^pi_[a-zA-Z0-9]+$/.test(order.paymentIntentId??'')&&order.taxTransactionId))||!q?.isValid||order.totalCents!==q.subtotalBeforeTaxCents+order.taxCents)throw new Error('Only reconciled Stripe test orders can export.');
 const qty={'big-chicken':0,'little-chicken':0,'big-beef':0,'little-beef':0};const lines=[...q.paidLines,...(q.welcomeLine?[q.welcomeLine]:[])];
 for(const line of lines){if(!(line.productId in qty)||!Number.isSafeInteger(line.quantity)||line.quantity<1)throw new Error('Invalid physical quantity.');qty[line.productId]+=line.quantity;}
 if(Object.values(qty).reduce((a,b)=>a+b,0)!==q.fulfillmentMealCount)throw new Error('Kitchen counts do not reconcile.');
 return {stripeMode:live?'live':'test',orderDateTime:new Date(createdAt).toISOString(),orderId:order.orderId,customerName:order.recipientName,recipientName:order.recipientName,email,phone:'',deliveryAddress:[order.address.streetAddress,order.address.city,order.address.state,order.address.zipCode].join(', '),bigChickenQty:qty['big-chicken'],littleChickenQty:qty['little-chicken'],bigBeefQty:qty['big-beef'],littleBeefQty:qty['little-beef'],totalMeals:q.fulfillmentMealCount,mealSubtotal:q.subtotalBeforeDiscountCents/100,discount:q.discountCents/100,salesTax:order.taxCents/100,totalPaid:order.totalCents/100,deliveryDate:order.cycle.deliveryDate,...(order.sessionId?{stripeSessionId:order.sessionId}:{stripePaymentIntentId:order.paymentIntentId}),mealBreakdown:lines.map(l=>`${l.name} — ${l.sauceName} ×${l.quantity}${l===q.welcomeLine?' (FREE WELCOME BOX)':''}`).join('\n'),paymentStatus:'paid',orderStatus:'New',notes:`${live?'Weekly subscription.':'STRIPE SANDBOX TEST — no delivery.'} ${order.sessionId?'Checkout Session':'PaymentIntent (reference in payment column)'}. Weekly plan ${order.planId}; ${q.paidMealCount} paid + ${q.freeMealCount} free.`,smsConsent:''};
}
export function sendVerifiedTestOrders(store,config,options){return sendVerifiedOrders(store,config,options,false)}
export function sendVerifiedLiveOrders(store,config,options){return sendVerifiedOrders(store,config,options,true)}
async function sendVerifiedOrders(store,config,{fetchImpl=fetch}={},live){
 if(store.environment!==(live?'stripe_live':'stripe_test')||config.spreadsheetId!==(live?PRODUCTION_WEEKLY_SHEET_ID:STAGING_WEEKLY_SHEET_ID)||!config.secret||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.url))throw new Error('Verified staging-only destination required.');
 const post=async body=>{const response=await fetchImpl(config.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({secret:config.secret,...body}),signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Staging Sheets request failed.');return response.json();};
 const diagnostic=await post({diagnostic:true});
 if(!diagnostic.ok||diagnostic.diagnostic!==true||diagnostic.headersValid!==true||diagnostic.spreadsheetName!==(live?'Fall 2026 ThreeByrd Weekly Orders - Production':'Fall 2026 ThreeByrd Weekly Orders - STAGING')||live&&diagnostic.spreadsheetId!==PRODUCTION_WEEKLY_SHEET_ID||diagnostic.worksheetName!=='Orders')throw new Error('Staging sheet destination verification failed.');
 const results=[];
 const rows=store.sql.prepare('SELECT e.*,c.email FROM weekly_test_exports e JOIN weekly_committed_orders o ON o.id=e.order_id JOIN weekly_customers c ON c.id=o.customer_id LEFT JOIN weekly_test_sheet_receipts r ON r.order_id=e.order_id WHERE r.order_id IS NULL').all();
 for(const row of rows){
  const signed=store.sql.prepare('SELECT 1 FROM weekly_test_paid_events WHERE purchase_id=?').get(row.order_id);
  const saved=JSON.parse(row.row_json);
  const recurring=store.sql.prepare("SELECT payment_intent_id,result FROM weekly_test_recurring WHERE id=? AND status='paid'").get(row.order_id);
  if(!signed&&(!recurring||recurring.payment_intent_id!==saved.paymentIntentId||JSON.parse(recurring.result).totalCents!==saved.totalCents||!JSON.parse(recurring.result).taxTransactionId))throw new Error('Verified payment evidence is missing.');
  if(!signed&&diagnostic.supportsWeeklyPaymentIntents!==true)throw new Error('Staging receiver needs the weekly payment-reference upgrade.');
  const order=buildVerifiedSheetOrder(saved,row.email,row.created_at,live);
  const result=await post({order});
  if(result.ok!==true||result.spreadsheetName!==diagnostic.spreadsheetName||result.worksheetName!=='Orders'||result.headersValid!==true||!(result.inserted===true||(result.duplicate===true&&Number.isSafeInteger(result.matchingRow)&&result.matchingRow>=2)))throw new Error('Staging receiver did not confirm this order.');
  store.sql.prepare('INSERT OR IGNORE INTO weekly_test_sheet_receipts VALUES(?,?,?)').run(row.order_id,JSON.stringify(result),store.clock());results.push(result);
 }
 const updates=store.sql.prepare('SELECT u.*,c.email FROM weekly_test_sheet_updates u JOIN weekly_committed_orders o ON o.id=u.order_id JOIN weekly_customers c ON c.id=o.customer_id WHERE u.receipt IS NULL ORDER BY u.order_id,u.revision').all();
 for(const update of updates){
  if(diagnostic.supportsWeeklyRevisions!==true)throw new Error('Staging receiver needs weekly revision support.');
  const evidence=store.sql.prepare("SELECT snapshot FROM weekly_test_adjustments WHERE order_id=? AND revision=? AND status='paid'").get(update.order_id,update.revision);
  const saved=JSON.parse(update.row_json);
  if(!evidence||JSON.parse(evidence.snapshot).totalCents!==saved.totalCents||JSON.parse(evidence.snapshot).quote.subtotalBeforeTaxCents!==saved.quote.subtotalBeforeTaxCents)throw new Error('Paid adjustment evidence missing.');
  const order={...buildVerifiedSheetOrder(saved,update.email,update.created_at,live),weeklyRevision:update.revision};
  const result=await post({order});
  if(!result.ok||result.revision!==update.revision||result.worksheetName!=='Orders'||result.spreadsheetName!==diagnostic.spreadsheetName||!(result.updated===true||result.duplicate===true)||!Number.isSafeInteger(result.matchingRow)||result.matchingRow<2)throw new Error('Staging revision not confirmed.');
  store.sql.prepare('UPDATE weekly_test_sheet_updates SET receipt=? WHERE order_id=? AND revision=?').run(JSON.stringify(result),update.order_id,update.revision);results.push(result);
 }
 return results;
}

