// Friday 3 PM Eastern. Delivery identity stays stable if Saturday/Sunday changes.
export const REVIEW_CALENDAR_VERSION='2026-fall-friday-3pm-v2';
export function fallReviewCalendar(){
 return [
 ['review-44',44,'2026-10-31','2026-10-30T15:00:00-04:00','open'],
 ['review-45',45,'2026-11-08','2026-11-06T15:00:00-05:00','open'],
 ['review-46',46,'2026-11-14','2026-11-13T15:00:00-05:00','open'],
 ['review-47',47,'2026-11-21','2026-11-20T15:00:00-05:00','closed'],
 ['review-48',48,'2026-11-28','2026-11-27T15:00:00-05:00','closed'],
 ['review-49',49,'2026-12-05','2026-12-04T15:00:00-05:00','open'],
 ].map(([id,sequence,deliveryDate,cutoffAt,status])=>({id,sequence,deliveryDate,cutoffAt,chargeAt:cutoffAt,status,...(status==='closed'?{closureReason:'Thanksgiving break — no order or charge.'}:{})}));
}
export function applyReviewCalendar(store){
 const desired=fallReviewCalendar(),old=store.calendar();
 const changed=desired.some(c=>JSON.stringify(old.find(o=>o.id===c.id))!==JSON.stringify(c));
 if(changed)store.publish([...old.filter(c=>!desired.some(d=>d.id===c.id)),...desired]);
}
