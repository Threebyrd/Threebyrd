import {ORDER_EMAIL_FROM,ORDER_EMAIL_REPLY_TO} from './email-delivery.mjs';
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
const allowed=['receipt','cutoff_reminder','payment_failed','order_changed','skipped','paused','canceled','holiday','plan_updated','resumed'];
export function weeklyEmailPreview(kind,{name='there',deliveryDate,cutoff,totalCents,manageUrl='http://localhost:3012/my-plan'}={}){
 if(!allowed.includes(kind))throw new Error('Unknown weekly email.');
 if(!['localhost','threebyrd.com'].includes(new URL(manageUrl).hostname)&&!['https://threebyrd-weekly-staging.thorbwag.workers.dev','https://weekly.threebyrd.com'].includes(new URL(manageUrl).origin))throw new Error('Untrusted management link.');
 const intro=`Hi ${name},`;
 const content={
  resumed:['Your ThreeByrd plan is active','Your plan has resumed. Check your upcoming deliveries and cutoff dates before your next eligible weekly charge.'],
  plan_updated:['Your ThreeByrd plan was updated','Your meal selections or delivery details were updated. Open your plan to review the affected weeks, prices, and cutoff dates. Previously purchased deliveries only change when you use their separate editing controls.'],
  receipt:['Your ThreeByrd order is confirmed',`Your delivery is scheduled for ${deliveryDate}. Total paid: ${money(totalCents)}. Your next eligible weekly order will be charged at its cutoff unless you change, skip, pause, or cancel before then.`],
  cutoff_reminder:['Your weekly meal cutoff is coming up',`Your next delivery is ${deliveryDate}. Review your meals before ${cutoff}. Your current subtotal before tax is ${money(totalCents)}; any changes will be shown before you confirm.`],
  payment_failed:['Action needed for your ThreeByrd order',`We could not complete payment for your ${deliveryDate} delivery. Your order is not confirmed for preparation. Open your plan to review the payment issue or contact luc@threebyrd.com.`],
  order_changed:['Your ThreeByrd order was updated',`Your changes for ${deliveryDate} are saved. Updated order total: ${money(totalCents)}. Review your plan for the payment or refund details.`],
  skipped:['Your ThreeByrd week is skipped',`Your ${deliveryDate} delivery is skipped. There is no charge for this skipped weekly cycle. Your plan continues with its next eligible week.`],
  paused:['Your ThreeByrd plan is paused','Your future weekly charges are paused. Check your plan for your selected return date, or resume when you are ready. Previously purchased deliveries remain on your plan.'],
  canceled:['Your ThreeByrd plan is canceled','Your future weekly charges are canceled. Previously purchased deliveries remain on your plan; contact support for help with those orders.'],
  holiday:['ThreeByrd holiday break',`We are closed for the ${deliveryDate} delivery. That week is skipped without a charge, and your plan resumes on its next eligible week.`],
 }[kind];
 return {from:ORDER_EMAIL_FROM,replyTo:ORDER_EMAIL_REPLY_TO,to:'luc@threebyrd.com',subject:'[SANDBOX PREVIEW] '+content[0],text:`${intro}\n\n${content[1]}\n\nManage your plan: ${manageUrl}\n\nThreeByrd Meal Prep\nluc@threebyrd.com\n\nLOCAL PREVIEW ONLY — no email has been sent.`,delivery:'preview_only'};
}
