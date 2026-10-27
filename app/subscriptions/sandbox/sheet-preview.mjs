// Read-only local mapping into the inspected staging Orders layout.
// Never passed to the existing Stripe checkout-session-only sender.
export const STAGING_WEEKLY_SHEET_ID='1yIAcqcs5jdivSJb1AfAxNiu8b4_MuFzLD0B8SpUY4oE';
export const STAGING_ORDERS_TAB_ID='1338815972';
export function weeklySheetPreview(order){
 if(order.environment!=='mock'||order.paymentStatus!=='paid')throw new Error('Only paid mock orders belong in this local preview.');
 const q=order.quote;
 if(!q?.isValid||order.totalCents!==q.subtotalBeforeTaxCents+order.taxCents)throw new Error('Order totals do not reconcile.');
 const quantities={'big-chicken':0,'little-chicken':0,'big-beef':0,'little-beef':0,'chicken-cup':0,'beef-cup':0};
 const lines=[...q.paidLines,...(q.welcomeLine?[q.welcomeLine]:[])];
 for(const line of lines){if(!(line.productId in quantities)||!Number.isSafeInteger(line.quantity)||line.quantity<1)throw new Error('Invalid kitchen quantity.');quantities[line.productId]+=line.quantity;}
 const total=Object.values(quantities).reduce((a,b)=>a+b,0);
 if(total!==q.fulfillmentMealCount)throw new Error('Kitchen quantities do not reconcile.');
 return {destination:{spreadsheetId:STAGING_WEEKLY_SHEET_ID,tabId:STAGING_ORDERS_TAB_ID},localPreviewOnly:true,orderId:order.orderId,columns:{
 'Order ID':order.orderId,'Customer Name':order.recipientName,
 'Ithaca Delivery Address':[order.address.streetAddress,order.address.city,order.address.state,order.address.zipCode].join(', '),
 'Big Chicken Qty':quantities['big-chicken'],'Little Chicken Qty':quantities['little-chicken'],'Big Beef Qty':quantities['big-beef'],'Little Beef Qty':quantities['little-beef'],
 'Chicken Cup Qty':quantities['chicken-cup'],'Beef Cup Qty':quantities['beef-cup'],
 'Total Meals':total,'Meal Subtotal':q.subtotalBeforeDiscountCents/100,'Discount':q.discountCents/100,'Sales Tax':order.taxCents/100,'Total Paid':order.totalCents/100,
 'Delivery Date':order.cycle.deliveryDate,'Meal Breakdown':lines.map(l=>`${l.name} — ${l.sauceName} ×${l.quantity}${l===q.welcomeLine?' (FREE WELCOME BOX)':''}`).join('\n'),
 'Payment Status':'MOCK PAID — NOT A REAL PAYMENT','Order Status':'LOCAL PREVIEW','Name':order.recipientName,
 'Notes':`Weekly plan ${order.planId}; ${q.paidMealCount} paid + ${q.freeMealCount} free; revision ${order.adjustmentRevision??0}. LOCAL PREVIEW ONLY.`,
 'Stripe Session ID':'',
 }};
}
