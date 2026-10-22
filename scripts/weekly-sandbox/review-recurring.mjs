// Operator-only, isolated Stripe TEST exercise with a simulated published cutoff.
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {backup} from 'node:sqlite';
import {WeeklyStore} from '../../app/subscriptions/sandbox/store.mjs';
import {prepareRecurringTest,processRecurringTest,createRecurringTestAdapter} from '../../app/subscriptions/sandbox/recurring-test.mjs';
const root='.local-previews/weekly-stage3/';
const path=root+'recurring-review.sqlite';
if(!existsSync(path)){
 const source=new WeeklyStore(root+'stripe-test.sqlite',{environment:'stripe_test'});
 try{await backup(source.sql,path)}finally{source.close()}
}
const store=new WeeklyStore(path,{environment:'stripe_test',clock:()=>Date.parse('2026-11-06T20:00:01Z')});
try{
 const adapter=createRecurringTestAdapter({testKey:readFileSync(root+'stripe-test-key','utf8').trim(),taxCode:'txcd_40060003'});
 const ids=prepareRecurringTest(store,'review-45');const results=[];
 for(const id of ids)results.push(await processRecurringTest(store,id,adapter));
 const report={notice:'STRIPE TEST ONLY — isolated copied database, simulated November 6 cutoff, no live funds or delivery',results,orders:store.sql.prepare("SELECT id,cycle_id FROM weekly_committed_orders WHERE cycle_id='review-45'").all()};
 writeFileSync(root+'recurring-review-result.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
}finally{store.close()}
