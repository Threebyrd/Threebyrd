import {weeklyOperations} from './operations.mjs';
import {paymentIssues,skipUnpaidTestDelivery} from './payment-recovery.mjs';
import {quoteTestPaidEdit,saveTestPaidEdit} from './test-paid-edits.mjs';
import { startTestPurchase, receiveTestPurchase } from './first-payment.mjs';
import { previewPaidEdit, savePaidEdit } from './paid-edits.mjs';
import { mockOperations, purchaseMockFirstDelivery } from './cutoff.mjs';
import { randomUUID } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDeliveryAddressFields } from '../../delivery-address.ts';
import { products, SAUCE_OPTIONS, quoteOrder } from '../../order-config.ts';
import { quoteWeeklyPlan } from '../quote.ts';
import { Problem,equal,hash } from './store-core.mjs';

export function createSandboxService({store,baseUrl,payments,checkAddress,devKey,staticRoot,assetRoot,siteRoot,firstPayments,sendLogin,hostedOrigin,assetFetch,allowedEmail,paidEdits,operatorEmail,recoveryAdapter,requestBackgroundCheck,productionOrigin,billingAllowed=()=>true}){
 const base=new URL(baseUrl);if(!(base.hostname==='localhost'&&base.protocol==='http:')&&!(productionOrigin==='https://weekly.threebyrd.com'&&base.origin===productionOrigin&&payments.environment==='stripe_live')&&!(hostedOrigin==='https://threebyrd-weekly-staging.thorbwag.workers.dev'&&base.origin===hostedOrigin))throw new Error('This review server is local-only. Use http://localhost and an isolated database.');
 const mailbox=[];
 const response=(data,status=200,headers={})=>Response.json(data,{status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff',...headers}});
 const cookie=request=>request.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith('weekly_sandbox='))?.slice('weekly_sandbox='.length);
 const requireOrigin=request=>{if(request.headers.get('origin')!==base.origin)throw new Problem(403,'Request origin is not allowed.')};
 const auth=(request,mutation=false)=>{
  const session=store.authenticate(cookie(request));if(!session)throw new Problem(401,'Use your email link to sign in.');
  if(mutation){requireOrigin(request);if(!equal(request.headers.get('x-csrf-token'),session.csrf))throw new Problem(403,'Refresh your session and try again.')}
  return session;
 };
 async function body(request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Problem(415,'Send JSON.');const text=await request.text();if(Buffer.byteLength(text)>16000)throw new Problem(413,'Request too large.');try{return JSON.parse(text)}catch{throw new Problem(400,'Invalid request.')}}
 async function address(input){const normalized=normalizeDeliveryAddressFields(input);if(!normalized)throw new Problem(400,'Enter a complete delivery address.');await checkAddress(normalized);return normalized}
 return {mailbox,async fetch(request){
  try{
   const url=new URL(request.url);if(url.origin!==base.origin)throw new Problem(403,'Invalid local host.');
   const path=url.pathname;
   if(productionOrigin&&request.method==='POST'&&['/api/enroll','/api/purchase','/api/paid-edit/save','/api/setup'].includes(path)&&!billingAllowed())throw new Problem(503,'Weekly plan signup and billing are temporarily paused. Existing plans can still be managed.');
   if(assetFetch&&request.method==='GET'&&!path.startsWith('/api/'))return assetFetch(request);
   if(request.method==='GET'&&(path==='/weekly-plan'||path==='/weekly-plan/'))return new Response(null,{status:302,headers:{location:'/?plan=weekly#order','cache-control':'no-store'}});
   if(siteRoot&&request.method==='GET'&&(path==='/site-theme.css'||path==='/'||['/order','/success','/privacy','/terms'].some(route=>path===route||path===route+'/')||path.startsWith('/_next/')||path.startsWith('/assets/')||path.startsWith('/favicon')||path.startsWith('/apple-touch')||path==='/site.webmanifest')){
    const root=fileURLToPath(siteRoot);
    if(path==='/site-theme.css'){
     const directory=resolve(root,'_next/static/css');const files=(await readdir(directory)).filter(name=>name.endsWith('.css'));
     return new Response((await Promise.all(files.map(name=>readFile(resolve(directory,name),'utf8')))).join('\n'),{headers:{'content-type':'text/css'}});
    }
    const local=resolve(root,'.'+path);if(!local.startsWith(root.replace(/\/$/,'')+'/')&&local!==root.replace(/\/$/,''))throw new Problem(404,'Not found');
    const filename=extname(path)?local:resolve(local,'index.html');
    try {const bytes=await readFile(filename);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};return new Response(bytes,{headers:{'content-type':types[extname(filename)]??'application/octet-stream','cache-control':'no-store','referrer-policy':'no-referrer'}})}catch{throw new Problem(404,'Local site artifact missing; run npm run build:weekly.');}
   }
   if(path==='/api/mock-join'&&request.method==='POST'){requireOrigin(request);return response({sandbox:true});}
   if(path==='/api/delivery-eligibility'&&request.method==='POST'){
    requireOrigin(request);const data=await body(request);const checked=await address(data.address);return response({normalizedAddress:`${checked.streetAddress}, ${checked.city}, ${checked.state} ${checked.zipCode}`,driveMinutes:10,sandbox:true});
   }
   if(path==='/api/checkout'&&request.method==='POST'){
    requireOrigin(request);const data=await body(request);if(!Array.isArray(data.items)||data.items.length>30||data.items.some(item=>!item||typeof item.productId!=='string'||!Number.isSafeInteger(item.quantity)))throw new Problem(400,'Invalid cart.');
    const quote=quoteOrder(data.items);if(!quote.isValid)throw new Problem(400,quote.errors.join(' '));await address(data.deliveryAddress);
    if(typeof data.recipientName!=='string'||!data.recipientName.trim())throw new Problem(400,'Enter a delivery name.');
    return response({url:`${baseUrl}/one-time-preview`,sandbox:true});
   }
   if(path==='/api/purchase-webhook'&&request.method==='POST'){
    return response(await receiveTestPurchase(store,firstPayments,await request.text(),request.headers.get('stripe-signature')));
   }
   if(path==='/api/purchase'&&request.method==='POST'){
    const session=auth(request,true),row=store.row(session.customer_id);
    if(!row)throw new Problem(409,'Enroll first.');
    if(!store.mapping(session.customer_id))store.saveMapping(session.customer_id,await payments.customer({email:session.email,customerId:session.customer_id}));
    return response(await startTestPurchase(store,firstPayments,session.customer_id));
   }
   if(path==='/api/setup-webhook'&&request.method==='POST'){
    if(!['stripe_test','stripe_live'].includes(payments.environment))return response({error:'Stripe test webhooks are disabled in mock mode.'},404);
    let event;try{event=await payments.verifyWebhook(await request.text(),request.headers.get('stripe-signature'))}catch{throw new Problem(400,'Invalid test setup webhook.')}
    return response(event?store.completeSetup(event):{ignored:true});
   }
   if(path==='/api/login'&&request.method==='POST'){
    requireOrigin(request);const data=await body(request);const mail=(!allowedEmail||typeof data.email==='string'&&data.email.trim().toLowerCase()===allowedEmail)?store.requestLink(data.email,request.headers.get('cf-connecting-ip')??'loopback'):null;
    if(mail){mailbox.push({id:randomUUID(),email:mail.email,url:`${baseUrl}/verify#${mail.token}`,expiresAt:store.clock()+900000});if(mailbox.length>30)mailbox.shift();
     if(sendLogin&&(productionOrigin||mail.email==='luc@threebyrd.com')){try{await sendLogin({email:mail.email,url:`${baseUrl}/verify#${mail.token}`})}catch{/* Keep generic response; operator can inspect the private local inbox. */}}
    }
    return response({message:'If the address can receive a sign-in link, it will arrive shortly. Check your inbox.'});
   }
   if(path==='/api/verify'&&request.method==='POST'){
    requireOrigin(request);const data=await body(request);const verified=store.verify(data.token);
    return response({ok:true},200,{'set-cookie':`weekly_sandbox=${verified.session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`});
   }
   if(path==='/api/logout'&&request.method==='POST'){auth(request,true);store.logout(cookie(request));return response({ok:true},200,{'set-cookie':'weekly_sandbox=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'})}
   if(path==='/api/dev-operations'&&request.method==='GET'){
    if(!devKey||!equal(request.headers.get('authorization'),`Bearer ${devKey}`))throw new Problem(403,'Private local operations.');
    if(store.environment==='stripe_test')return response({notice:'STRIPE TEST ONLY — staging fulfillment; no live funds or delivery',subscribers:store.sql.prepare('SELECT p.customer_id,c.email,p.plan_id,p.data,p.readiness FROM weekly_plans p JOIN weekly_customers c ON c.id=p.customer_id').all().map(r=>({...r,data:JSON.parse(r.data)})),payments:store.sql.prepare('SELECT id,customer_id,cycle_id,status FROM weekly_test_recurring').all(),orders:store.sql.prepare('SELECT row_json FROM weekly_test_exports').all().map(r=>JSON.parse(r.row_json)),adjustments:store.sql.prepare('SELECT id,order_id,revision,status FROM weekly_test_adjustments').all(),emailIssues:store.sql.prepare("SELECT id,kind,status FROM weekly_email_outbox WHERE status IN ('review_required','sending')").all()});
    return response(mockOperations(store));
   }
   if(path==='/api/dev-inbox'&&request.method==='GET'){
    if(!devKey||!equal(request.headers.get('authorization'),`Bearer ${devKey}`))throw new Problem(403,'Private local inbox.');
    return response({messages:mailbox.filter(mail=>mail.expiresAt>store.clock())});
   }
   if(path==='/api/catalog'&&request.method==='GET')return response({products, sauces:SAUCE_OPTIONS,calendar:store.calendar(),disclosure:store.disclosure,disclosureVersion:store.disclosureVersion,mode:payments.environment});
   if(path==='/api/quote'&&request.method==='POST'){
    requireOrigin(request);const data=await body(request);if(!Array.isArray(data.cart)||data.cart.length>30||data.cart.some(item=>!item||typeof item.productId!=='string'||!Number.isSafeInteger(item.quantity)||typeof item.sauceId!=='string'))throw new Problem(400,'Choose valid meals.');
    return response({quote:quoteWeeklyPlan(data.cart,null,store.availability())});
   }
   if(path==='/api/operations'&&request.method==='GET'){
    const session=auth(request);if(!operatorEmail||session.email!==operatorEmail)throw new Problem(403,'Operator access required.');
    return response(weeklyOperations(store));
   }
   if(path==='/api/operations/checks'&&request.method==='POST'){
    const session=auth(request,true);if(!operatorEmail||session.email!==operatorEmail)throw new Problem(403,'Operator access required.');
    if(!requestBackgroundCheck)throw new Problem(409,'Background checks are unavailable.');
    await requestBackgroundCheck();return response({scheduled:true});
   }
   if(path==='/api/payment-recovery/skip'&&request.method==='POST'){
    const session=auth(request,true),data=await body(request);
    return response(await skipUnpaidTestDelivery(store,recoveryAdapter,session.customer_id,data.jobId));
   }
   if(path==='/api/me'&&request.method==='GET'){const session=auth(request);return response({...store.state(session.customer_id),email:session.email,csrf:session.csrf,isOperator:!!operatorEmail&&session.email===operatorEmail,paymentIssues:paymentIssues(store,session.customer_id)})}
   if(path==='/api/enroll'&&request.method==='POST'){
    const session=auth(request,true),data=await body(request);const checked=await address(data.address);return response(store.enroll(session.customer_id,data,checked));
   }
   if(['/api/paid-edit/preview','/api/paid-edit/save'].includes(path)&&request.method==='POST'){
    const session=auth(request,true),data=await body(request);
    if(['stripe_test','stripe_live'].includes(payments.environment)){if(!paidEdits)throw new Problem(409,'Test paid-order edits are not configured.');return response(await (path.endsWith('/preview')?quoteTestPaidEdit(store,paidEdits,session.customer_id,data):saveTestPaidEdit(store,paidEdits,session.customer_id,data)));}
    return response(path.endsWith('/preview')?previewPaidEdit(store,session.customer_id,data):savePaidEdit(store,session.customer_id,data));
   }
   if(path==='/api/plan'&&request.method==='POST'){
    const session=auth(request,true),data=await body(request);const checked=data.action==='address'?await address(data.address):undefined;return response(store.mutate(session.customer_id,data,checked));
   }
   if(path==='/api/setup'&&request.method==='POST'){
    const session=auth(request,true),row=store.row(session.customer_id);if(!row||row.plan.status==='canceled')throw new Problem(409,'Enroll in an available plan first.');
    let mapped=store.mapping(session.customer_id);
    if(!mapped)mapped=store.saveMapping(session.customer_id,await payments.customer({email:session.email,customerId:session.customer_id}));
    const setup=await payments.setup({stripeCustomerId:mapped,planId:row.plan.id,customerId:session.customer_id});
    store.startSetup(session.customer_id,setup.id,mapped,row.plan.id);return response({url:setup.url,mode:payments.environment});
   }
   if(path==='/api/mock-setup'&&request.method==='POST'){
    const session=auth(request,true);if(payments.environment!=='mock')throw new Problem(404,'Mock setup disabled.');
    const data=await body(request),attempt=store.sql.prepare('SELECT * FROM weekly_setup_attempts WHERE id=? AND customer_id=? AND environment=?').get(data.setupId,session.customer_id,'mock');
    if(!attempt)throw new Problem(404,'Setup not found.');
    if(data.outcome==='success'){
     const saved=store.completeSetup({eventId:'mock:'+attempt.id,setupId:attempt.id,stripeCustomerId:attempt.stripe_customer_id,paymentMethodId:'pm_mock_'+hash(attempt.id).slice(0,20),livemode:false,status:'succeeded'});
     return response({...saved,purchase:purchaseMockFirstDelivery(store,session.customer_id)});
    }
    if(!['failed','canceled'].includes(data.outcome))throw new Problem(400,'Unknown test outcome.');
    store.sql.prepare('UPDATE weekly_setup_attempts SET status=? WHERE id=?').run(data.outcome,attempt.id);return response({saved:false});
   }
   if(request.method==='GET'&&['/','/weekly-signup','/my-plan','/verify','/dev','/operations','/terms-draft','/privacy-draft','/one-time-preview'].includes(path)||request.method==='GET'&&path.startsWith('/mock-card/')){
    let html=await readFile(new URL('index.html',staticRoot),'utf8');if(sendLogin)html=html.replace('NO CHARGES OR REAL EMAILS','NO LIVE CHARGES · TEST EMAILS TO LUC ONLY');return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",'x-content-type-options':'nosniff'}});
   }
   if(request.method==='GET'&&['/client.js','/style.css'].includes(path)){
    let content=await readFile(new URL(path.slice(1),staticRoot),'utf8');
    if(sendLogin&&path==='/client.js')content=content.replace('Local testing: emails appear only in the private developer inbox opened beside this sandbox. Nothing is sent to a real mailbox.','Email testing is enabled only for luc@threebyrd.com. Sign-in links expire after 15 minutes and work only on this computer.');
    return new Response(content,{headers:{'content-type':path.endsWith('.js')?'text/javascript':'text/css','cache-control':'no-store'}});
   }
   const asset=products.find(p=>p.image===path);
   if(request.method==='GET'&&asset)return new Response(await readFile(new URL(path.slice(1),assetRoot)),{headers:{'content-type':'image/jpeg'}});
   return response({error:'Not found'},404);
  }catch(error){return response({error:error instanceof Problem?error.message:'The request could not be completed. Refresh and try again.'},error instanceof Problem?error.status:400)}
 }};
}
