import {assertAdapter} from './stripe-policy.mjs';
import {Problem} from './store-core.mjs';
import {queueWeeklyEmail} from './email-outbox.mjs';
export function paymentIssues(store,customerId){
 return store.sql.prepare("SELECT j.id,j.cycle_id,j.status,j.snapshot FROM weekly_test_recurring j LEFT JOIN weekly_payment_resolutions r ON r.job_id=j.id WHERE j.customer_id=? AND j.status!='paid' AND r.job_id IS NULL").all(customerId).map(row=>({id:row.id,cycleId:row.cycle_id,status:row.status,deliveryDate:JSON.parse(row.snapshot).cycle.deliveryDate,canSkip:['failed','requires_action'].includes(row.status)}));
}
export async function skipUnpaidTestDelivery(store,adapter,customerId,jobId){
 const live=assertAdapter(store,adapter);
 const row=store.sql.prepare('SELECT * FROM weekly_test_recurring WHERE id=? AND customer_id=?').get(jobId,customerId);
 if(!row)throw new Problem(404,'Payment not found.');
 if(store.sql.prepare('SELECT 1 FROM weekly_payment_resolutions WHERE job_id=?').get(jobId))return {skipped:true,duplicate:true};
 if(!['failed','requires_action'].includes(row.status)||!row.payment_intent_id)throw new Problem(409,'This payment requires support review.');
 // A setup link only changes future billing; never automatically retry a past cutoff.
 const intent=await adapter.cancelFailed(row.payment_intent_id,jobId);
 const snapshot=JSON.parse(row.snapshot);
 if(intent.id!==row.payment_intent_id||intent.livemode!==live||intent.customer!==snapshot.stripeCustomerId||intent.metadata?.weekly_recurring_id!==jobId||intent.status!=='canceled')throw new Problem(409,'Payment could not be safely closed. Contact support.');
 return store.transaction(()=>{
  if(store.sql.prepare('SELECT 1 FROM weekly_committed_orders WHERE id=?').get(jobId))throw new Problem(409,'This delivery has already been purchased. Contact support.');
  store.sql.prepare("INSERT OR IGNORE INTO weekly_payment_resolutions VALUES(?,?,'skip_unpaid',?)").run(jobId,customerId,store.clock());
  queueWeeklyEmail(store,{id:`unpaid-skipped:${jobId}`,customerId,kind:'skipped',details:{deliveryDate:snapshot.cycle.deliveryDate}});
  return {skipped:true};
 });
}
