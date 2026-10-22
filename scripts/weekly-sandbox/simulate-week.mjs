import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WeeklyStore, DISCLOSURE_VERSION } from '../../app/subscriptions/sandbox/store.mjs';
import { runMockCutoff, resolveMockPayment, mockOperations } from '../../app/subscriptions/sandbox/cutoff.mjs';
import { sampleCalendar } from './server.mjs';

// Independent fictional exercise: never opens the customer's review database.
let now=Date.parse('2026-10-21T17:00:00Z');
const store=new WeeklyStore(':memory:',{clock:()=>now});
try {
 store.publish(sampleCalendar());
 const customers=[];
 for(const name of ['paid','failed','skipped','paused']) {
  const c=store.verify(store.requestLink(`${name}@example.test`,name).token).customer;
  store.enroll(c.id,{cart:[{productId:'big-chicken',quantity:3,sauceId:'bbq'}],welcome:{productId:'little-beef',sauceId:'bbq'},recipientName:`Test ${name}`,authorized:true,disclosureVersion:DISCLOSURE_VERSION},{streetAddress:'123 State St',city:'Ithaca',state:'NY',zipCode:'14850'});
  store.startSetup(c.id,name,'mock-'+name,store.row(c.id).plan.id);
  store.completeSetup({eventId:name,setupId:name,stripeCustomerId:'mock-'+name,paymentMethodId:'mock-card',livemode:false,status:'succeeded'});
  customers.push({...c,name});
 }
 const cycle=store.calendar().find(c=>c.status==='open'&&Date.parse(c.cutoffAt)>now);
 for(const c of customers.filter(c=>['skipped','paused'].includes(c.name)))store.mutate(c.id,{action:c.name==='skipped'?'skip':'pause',cycleId:cycle.id,resumeCycleId:null,version:store.row(c.id).version});
 now=Date.parse(cycle.cutoffAt);
 const results=runMockCutoff(store,cycle.id,{outcomes:{[customers[1].id]:'failed'}});
 const beforeRecovery=mockOperations(store);
 resolveMockPayment(store,results.find(r=>r.customer_id===customers[1].id).id,'paid');
 runMockCutoff(store,cycle.id);
 const afterRecovery=mockOperations(store);
 const dir=resolve('.local-previews/weekly-stage3');mkdirSync(dir,{recursive:true});
 writeFileSync(resolve(dir,'operations.json'),JSON.stringify({cycle,results,beforeRecovery,afterRecovery},null,2));
 const cell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
 const rows=[['Order ID','Order type','Plan ID','Delivery date','Recipient','Payment status','Paid meals','Free meals','First-week gift','Subtotal cents','Mock tax cents','Total cents'],...afterRecovery.orders.map(o=>[o.orderId,o.orderType,o.planId,o.cycle.deliveryDate,o.recipientName,o.paymentStatus,o.quote.paidMealCount,o.quote.freeMealCount,o.firstWeekGift,o.quote.subtotalBeforeTaxCents,o.taxCents,o.totalCents])];
 writeFileSync(resolve(dir,'orders.csv'),rows.map(r=>r.map(cell).join(',')).join('\n')+'\n');
 console.log(`Simulated 4 plans: 1 paid, 1 failed, 1 skipped, 1 paused. Before recovery: ${beforeRecovery.orders.length} preparation row. After recovery and rerun: ${afterRecovery.orders.length} unique rows.`);
 console.log(`Local review files: ${dir}/operations.json and orders.csv. No external writes.`);
} finally {store.close()}
