// Run only after the owner completes Stripe verification. Never charges a card.
import Stripe from 'stripe';import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const root='.local-previews/weekly-production/';
const config=JSON.parse(readFileSync('wrangler.weekly-production.jsonc','utf8'));
if(config.vars.WEEKLY_BILLING_ENABLED!=='false'||config.vars.WEEKLY_CUSTOMER_EMAILS_ENABLED!=='false')throw Error('Keep billing and customer emails disabled during configuration.');
if(!existsSync(root+'stripe-live-key'))throw Error('Owner verification is required to reuse the existing Stripe live credential. Do not create a replacement key automatically.');
const key=readFileSync(root+'stripe-live-key','utf8').trim();if(!/^sk_live_/.test(key))throw Error('Existing production key required.');
const stripe=new Stripe(key);const account=await stripe.accounts.retrieve();if(account.id!=='acct_1UBJ2iCmcRTrEecL')throw Error('Unexpected Stripe account.');
const url='https://weekly.threebyrd.com/api/stripe-webhook',path=root+'webhook.json';let hook;
if(existsSync(path)){hook=JSON.parse(readFileSync(path,'utf8'));const remote=await stripe.webhookEndpoints.retrieve(hook.id);if(remote.url!==url||remote.livemode!==true||remote.status!=='enabled')throw Error('Live webhook configuration mismatch.');}
else{hook=await stripe.webhookEndpoints.create({url,enabled_events:['checkout.session.completed','payment_intent.succeeded','payment_intent.payment_failed'],description:'ThreeByrd weekly plans — live webhook; billing disabled during rollout'},{idempotencyKey:'threebyrd-weekly-live-webhook-v1'});if(hook.livemode!==true||!hook.secret)throw Error('Unexpected live webhook result.');writeFileSync(path,JSON.stringify(hook),{mode:0o600});}
const secrets=[['STRIPE_SECRET_KEY',key],['WEEKLY_STRIPE_WEBHOOK_SECRET',hook.secret]];
if(existsSync(root+'sheets-live-config.json')){const value=readFileSync(root+'sheets-live-config.json','utf8');const sheets=JSON.parse(value);if(sheets.spreadsheetId!=='1NCVNbcIUnzH5nMhlxvu1qus2xPIOOC-JOx4rHqJ-Or8'||!sheets.secret||!/^https:\/\/script.google.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(sheets.url))throw Error('Pinned production receiver required.');secrets.push(['WEEKLY_SHEETS_CONFIG',value]);}
for(const [name,value] of secrets){const child=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','put',name,'--config','wrangler.weekly-production.jsonc'],{input:value,encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:'/tmp/threebyrd-weekly-production-secrets.log'}});if(child.status!==0)throw Error('Could not configure '+name);console.log('Configured '+name+' (value hidden).');}
console.log('Live connections prepared. Billing/customer emails remain disabled. Verify receiver and readiness before launch.');
