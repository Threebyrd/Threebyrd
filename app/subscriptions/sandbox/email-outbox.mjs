import {weeklyEmailPreview} from './email-preview.mjs';
// Called inside the business transaction: a rolled-back change cannot send mail.
export function queueWeeklyEmail(store,{id,customerId,kind,details={}}){
 const customer=store.sql.prepare('SELECT email FROM weekly_customers WHERE id=?').get(customerId);
 if(!customer)throw new Error('Unknown email customer.');
 store.sql.prepare("INSERT OR IGNORE INTO weekly_email_outbox(id,customer_id,recipient,kind,details,status,created_at) VALUES(?,?,?,?,?,'pending',?)").run(id,customerId,customer.email,kind,JSON.stringify(details),store.clock());
}
export async function drainWeeklyEmails(store,{send,baseUrl,limit=10,customerEmailsEnabled=false}){
 const url=new URL(baseUrl);
 const production=store.environment==='stripe_live'&&url.href==='https://weekly.threebyrd.com/';
 if(!production&&!(url.protocol==='http:'&&url.hostname==='localhost'&&url.pathname==='/')&&url.href!=='https://threebyrd-weekly-staging.thorbwag.workers.dev/')throw new Error('Only the local sandbox is supported.');
 if(!Number.isInteger(limit)||limit<1||limit>30)throw new Error('Invalid batch size.');
 const results=[];
 for(let i=0;i<limit;i++){
  const row=store.transaction(()=>{
   const next=store.sql.prepare("SELECT * FROM weekly_email_outbox WHERE status='pending' ORDER BY created_at,id LIMIT 1").get();
   if(!next)return null;
   // Never redirect another person's sign-in or order details into the test inbox.
   const status=production?(customerEmailsEnabled?'sending':'pending'):(next.recipient==='luc@threebyrd.com'?'sending':'blocked_recipient');
   store.sql.prepare('UPDATE weekly_email_outbox SET status=? WHERE id=?').run(status,next.id);return {...next,status};
  });
  if(!row||row.status==='pending')break;
  if(row.status==='blocked_recipient'){results.push({id:row.id,status:row.status});continue;}
  const details=JSON.parse(row.details);
  if(['cutoff_reminder','holiday'].includes(row.kind)){
   const current=store.row(row.customer_id);
   const decision=current&&store.state(row.customer_id).preview?.cycles.find(c=>c.cycle.id===details.cycleId);
   const remaining=decision?Date.parse(decision.cycle.cutoffAt)-store.clock():0;
   if(!current||current.plan.id!==details.planId||current.plan.status!=='active'||remaining<=0||remaining>86400000||decision.status!==(row.kind==='holiday'?'closed':'ready')){
    store.sql.prepare("UPDATE weekly_email_outbox SET status='review_required' WHERE id=?").run(row.id);results.push({id:row.id,status:'review_required'});continue;
   }
  }
  const preview=weeklyEmailPreview(row.kind,{...details,manageUrl:url.origin+'/my-plan'});
  const message={from:preview.from,reply_to:preview.replyTo,to:[row.recipient],subject:preview.subject.replace('[SANDBOX PREVIEW]','[SANDBOX TEST]'),text:preview.text.replace('LOCAL PREVIEW ONLY — no email has been sent.','SANDBOX TEST — no real delivery or live payment.')};
  if(production){message.subject=preview.subject.replace('[SANDBOX PREVIEW] ','');message.text=preview.text.replace('\n\nLOCAL PREVIEW ONLY — no email has been sent.','');}
  try{
   const receipt=await send(message);
   if(!receipt?.messageId)throw new Error('Missing delivery receipt.');
   store.sql.prepare("UPDATE weekly_email_outbox SET status='accepted',receipt=? WHERE id=?").run(JSON.stringify(receipt),row.id);
   results.push({id:row.id,status:'accepted'});
  }catch{
   // A timeout can occur after provider acceptance. Do not automatically resend.
   store.sql.prepare("UPDATE weekly_email_outbox SET status='review_required' WHERE id=?").run(row.id);
   results.push({id:row.id,status:'review_required'});
  }
 }
 return results;
}

// Local scheduler preparation only. Never creates a payment or an order.
export function queueUpcomingNotices(store,{withinHours=24}={}){
 if(!Number.isFinite(withinHours)||withinHours<=0||withinHours>48)throw new Error('Invalid reminder window.');
 return store.transaction(()=>{
  let count=0;
  for(const row of store.sql.prepare('SELECT customer_id FROM weekly_plans').all()){
   const record=store.row(row.customer_id);
   if(record.plan.status!=='active'||record.readiness!=='staged_ready')continue;
   const state=store.state(row.customer_id);
   for(const decision of state.preview.cycles){
    const remaining=Date.parse(decision.cycle.cutoffAt)-store.clock();
    if(remaining<=0||remaining>withinHours*3600000)continue;
    if(!['ready','closed'].includes(decision.status))continue;
    const kind=decision.status==='closed'?'holiday':'cutoff_reminder';
    const cutoff=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'full',timeStyle:'short'}).format(new Date(decision.cycle.cutoffAt))+' Eastern time';
    const id=`${kind}:${record.plan.id}:${decision.cycle.id}`;
    queueWeeklyEmail(store,{id,customerId:row.customer_id,kind,details:{planId:record.plan.id,cycleId:decision.cycle.id,name:record.recipient_name,deliveryDate:decision.cycle.deliveryDate,cutoff,totalCents:decision.quote?.subtotalBeforeTaxCents}});count++;
   }
  }
  return {eligibleNotices:count};
 });
}
