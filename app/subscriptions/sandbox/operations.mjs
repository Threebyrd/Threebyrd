/** Private read model. Never exposes payment credentials, tokens, or raw provider responses. */
export function weeklyOperations(store){
 const subscribers=store.sql.prepare('SELECT p.customer_id,c.email FROM weekly_plans p JOIN weekly_customers c ON c.id=p.customer_id').all().map(row=>{
  const state=store.state(row.customer_id);
  return {customerId:row.customer_id,email:row.email,name:state.recipientName,status:state.plan.status,readiness:state.readiness,nextDelivery:state.preview.next?.cycle.deliveryDate??null,nextCutoff:state.preview.next?.cycle.cutoffAt??null,paidOrders:state.committedOrders.length};
 });
 const payments=store.sql.prepare('SELECT id,customer_id,cycle_id,status FROM weekly_test_recurring').all().map(row=>({...row,resolved:!!store.sql.prepare('SELECT 1 FROM weekly_payment_resolutions WHERE job_id=?').get(row.id)}));
 const orders=store.sql.prepare('SELECT id,customer_id,cycle_id FROM weekly_committed_orders').all().map(row=>{
  const receipt=store.sql.prepare('SELECT receipt FROM weekly_test_sheet_receipts WHERE order_id=?').get(row.id);
  const revisions=store.sql.prepare('SELECT revision,receipt FROM weekly_test_sheet_updates WHERE order_id=? ORDER BY revision').all(row.id);
  return {...row,sheetStatus:!receipt?'pending':revisions.some(r=>!r.receipt)?'revision_pending':'synced',revision:revisions.at(-1)?.revision??0};
 });
 const emailIssues=store.sql.prepare("SELECT id,kind,status FROM weekly_email_outbox WHERE status IN ('review_required','sending')").all();
 return {runtime:store.sql.prepare('SELECT task,status,checked_at FROM weekly_runtime_status ORDER BY task').all(),environment:store.environment,generatedAt:new Date(store.clock()).toISOString(),subscribers,payments,orders,emailIssues,calendar:store.calendar(),summary:{active:subscribers.filter(s=>s.status==='active').length,paused:subscribers.filter(s=>s.status==='paused').length,canceled:subscribers.filter(s=>s.status==='canceled').length,paymentIssues:payments.filter(p=>!p.resolved&&['failed','requires_action','review_required','processing'].includes(p.status)).length,pendingExports:orders.filter(o=>o.sheetStatus!=='synced').length}};
}
