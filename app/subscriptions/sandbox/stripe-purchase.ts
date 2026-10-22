import type Stripe from "stripe";
import type { WeeklyQuote } from "../quote.ts";

export type FirstPurchase = {
 id: string; customerId: string; stripeCustomerId: string; planId: string;
 cycleId: string; cutoffAt: string; quote: WeeklyQuote;
 address: { streetAddress: string; city: string; state: string; zipCode: string };
 recipientName: string;
};

/** Discount is allocated in cents, once across the cart; sauce charges stay full-price. */
export function weeklyPaymentParams(baseUrl: string, purchase: FirstPurchase, taxCode: string): Stripe.Checkout.SessionCreateParams {
 const q=purchase.quote;
 if(!q.isValid || !taxCode.startsWith("txcd_") || !purchase.id || !purchase.stripeCustomerId.startsWith("cus_")) throw new Error("Invalid trusted purchase snapshot.");
 const lines: Stripe.Checkout.SessionCreateParams.LineItem[]=[];
 let discount=q.discountCents;
 let remainingMeals=q.mealSubtotalCents;
 for(const line of q.paidLines){
  for(let i=0;i<line.quantity;i++){
   const reduction=Math.min(discount,Math.round(line.mealUnitAmountCents*discount/remainingMeals));discount-=reduction;remainingMeals-=line.mealUnitAmountCents;
   lines.push({quantity:1,price_data:{currency:"usd",tax_behavior:"exclusive",unit_amount:line.mealUnitAmountCents-reduction+line.sauceUnitAmountCents,product_data:{name:`${line.name} · ${line.sauceName}`,tax_code:taxCode}}});
  }
 }
 if(discount!==0 || lines.reduce((sum,l)=>sum+(l.price_data?.unit_amount??0),0)!==q.subtotalBeforeTaxCents)throw new Error("Purchase prices do not reconcile.");
 if(q.welcomeLine)lines.push({quantity:1,price_data:{currency:"usd",tax_behavior:"exclusive",unit_amount:0,product_data:{name:`FREE welcome box: ${q.welcomeLine.name} · ${q.welcomeLine.sauceName}`,tax_code:taxCode}}});
 const metadata={weekly_purchase_id:purchase.id,weekly_plan_id:purchase.planId,weekly_customer_id:purchase.customerId,weekly_cycle_id:purchase.cycleId};
 return {mode:"payment",customer:purchase.stripeCustomerId,payment_method_types:["card"],line_items:lines,automatic_tax:{enabled:true},payment_intent_data:{setup_future_usage:"off_session",metadata},metadata,success_url:`${baseUrl}/my-plan?payment=returned`,cancel_url:`${baseUrl}/my-plan?payment=canceled`};
}
