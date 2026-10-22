import {readFileSync,existsSync,writeFileSync} from 'node:fs';import {backup} from 'node:sqlite';
import {WeeklyStore} from '../../app/subscriptions/sandbox/store.mjs';
import {quoteTestPaidEdit,saveTestPaidEdit,createTestEditAdapter} from '../../app/subscriptions/sandbox/test-paid-edits.mjs';
const root='.local-previews/weekly-stage3/',path=root+'paid-edits-review.sqlite';
if(!existsSync(path)){const source=new WeeklyStore(root+'stripe-test.sqlite',{environment:'stripe_test'});try{await backup(source.sql,path)}finally{source.close()}}
const store=new WeeklyStore(path,{environment:'stripe_test',clock:()=>Date.parse('2026-10-29T17:00:00Z')});
try{
 const adapter=createTestEditAdapter({testKey:readFileSync(root+'stripe-test-key','utf8').trim(),taxCode:'txcd_40060003'});
 store.sql.exec('CREATE TABLE IF NOT EXISTS weekly_edit_reviews (id TEXT PRIMARY KEY, quote TEXT NOT NULL)');
 const order=store.sql.prepare('SELECT * FROM weekly_committed_orders LIMIT 1').get();if(!order)throw new Error('Verified test first purchase required.');
 const results=[];
 for(const [id,quantity] of [['add-one',4],['remove-added',3]]){
  let saved=store.sql.prepare('SELECT quote FROM weekly_edit_reviews WHERE id=?').get(id);
  if(!saved){const quote=await quoteTestPaidEdit(store,adapter,order.customer_id,{orderId:order.id,cart:[{productId:'big-chicken',quantity,sauceId:'bbq'}]});store.sql.prepare('INSERT INTO weekly_edit_reviews VALUES(?,?)').run(id,JSON.stringify(quote));saved={quote:JSON.stringify(quote)}}
  const quote=JSON.parse(saved.quote);const result=await saveTestPaidEdit(store,adapter,order.customer_id,{quoteId:quote.quoteId,approvedDeltaCents:quote.deltaCents});results.push({id,deltaCents:quote.deltaCents,...result});if(result.outcome!=='paid')break;
 }
 writeFileSync(root+'paid-edits-review-results.json',JSON.stringify(results,null,2),{mode:0o600});console.log(JSON.stringify({notice:'Stripe TEST only — isolated copied database; no delivery or customer email',results}));
}finally{store.close()}
