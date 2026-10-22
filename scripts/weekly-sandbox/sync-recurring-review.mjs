import {readFileSync} from 'node:fs';
import {WeeklyStore} from '../../app/subscriptions/sandbox/store.mjs';
import {sendVerifiedTestOrders} from '../../app/subscriptions/sandbox/test-sheet-sync.mjs';
const store=new WeeklyStore('.local-previews/weekly-stage3/recurring-review.sqlite',{environment:'stripe_test'});
try{const config=JSON.parse(readFileSync('.local-previews/weekly-stage3/sheets-test-config.json','utf8'));console.log(JSON.stringify(await sendVerifiedTestOrders(store,config)));}finally{store.close()}
