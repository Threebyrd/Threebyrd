// Scoped to the isolated weekly staging Worker and the existing Stripe test account.
import Stripe from 'stripe';import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const key=readFileSync('.local-previews/weekly-stage3/stripe-test-key','utf8').trim();if(!/^sk_test_/.test(key))throw new Error('Test key required.');
const stripe=new Stripe(key);const path='.local-previews/weekly-hosted/webhook.json';
let webhook;
if(existsSync(path))webhook=JSON.parse(readFileSync(path,'utf8'));
else{webhook=await stripe.webhookEndpoints.create({url:'https://threebyrd-weekly-staging.thorbwag.workers.dev/api/stripe-webhook',enabled_events:['checkout.session.completed','payment_intent.succeeded','payment_intent.payment_failed'],description:'Isolated ThreeByrd weekly staging — TEST ONLY'},{idempotencyKey:'threebyrd-weekly-hosted-test-webhook-v1'});if(webhook.livemode!==false||!webhook.secret)throw new Error('Unexpected webhook environment.');writeFileSync(path,JSON.stringify(webhook),{mode:0o600});}
for(const [name,value] of [['WEEKLY_STRIPE_TEST_KEY',key],['WEEKLY_STRIPE_TEST_WEBHOOK_SECRET',webhook.secret],['SHEETS_TEST_CONFIG',readFileSync('.local-previews/weekly-stage3/sheets-test-config.json','utf8')]]){
 const child=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','put',name,'--config','wrangler.weekly-review.jsonc'],{input:value,encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:'/tmp/threebyrd-weekly-test-secrets.log'}});
 if(child.status!==0){console.log('Could not set '+name);process.exit(1)}console.log('Configured isolated staging secret: '+name);
}
console.log('Stripe test webhook and staging-only secrets configured. No production account or route changed.');
