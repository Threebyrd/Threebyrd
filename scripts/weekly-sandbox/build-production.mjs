// Build management assets only. Does not publish or enable the main website toggle.
import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
const root='.local-previews/weekly-production/site';await mkdir(root,{recursive:true});
await cp('.local-previews/weekly-hosted/site',root,{recursive:true});
for(const file of ['index.html','client.js','style.css']){
 let text=await readFile('scripts/weekly-sandbox/'+file,'utf8');
 const replacements=[
 ['LOCAL SANDBOX · SAMPLE DELIVERY DATES · NO CHARGES OR REAL EMAILS','THREEBYRD WEEKLY PLAN'],
 ['Local testing: emails appear only in the private developer inbox opened beside this sandbox. Nothing is sent to a real mailbox.','Sign-in links expire after 15 minutes and can be used once.'],
 ['Sandbox address checks use fictional test eligibility for Ithaca. Production delivery checks remain separate.','We verify your address using our current delivery-area rules.'],
 ['This sandbox uses Stripe test payments; no live money is charged.','Your payment is processed securely by Stripe.'],
 ['Sandbox payments only. No live charges or real deliveries.','Eligible weeks are charged at their published cutoff.'],
 ['Test card saved. Check your purchased delivery below.','Card saved. Check your purchased delivery below.'],
 ['Save a test payment method to finish setup.','Save a payment method to finish setup.'],
 ['Update test card','Update payment card'],['Save test card','Save payment card'],
 ['STRIPE TEST PAYMENT VERIFIED','PAYMENT VERIFIED'],['Stripe test total paid','Total paid'],
 ['Stripe test only; no real deliveries.','Production subscriptions.'],['PRIVATE · STAGING','PRIVATE · OPERATIONS'],
 ['LOCAL DRAFT · NOT PUBLISHED','THREEBYRD MEAL PREP'],['draft terms','weekly plan terms'],['This sandbox uses a private mock inbox and no real customer emails.','We use Cloudflare to send secure access links and order emails.'],['Retention and email-provider details must be finalized before launch.','Contact luc@threebyrd.com with privacy requests; see our Privacy Policy at https://threebyrd.com/privacy/.'],['(draft)',''],
 ['ThreeByrd | Weekly plan sandbox','ThreeByrd | Manage weekly plan'],
 ['Final taxes, payment-failure recovery timing, launch date, price-change notices and post-cutoff refund procedures must be finalized before billing can launch.','Contact luc@threebyrd.com for payment or delivery assistance.'],
 ];
 for(const [before,after] of replacements)text=text.replaceAll(before,after);
 text=text.replaceAll('href="/weekly-plan"','href="https://threebyrd.com/?plan=weekly#order"');
 text=text.replaceAll("location.replace('/?plan=weekly#order')","location.replace('https://threebyrd.com/?plan=weekly#order')").replaceAll("location.replace('/?plan=weekly&edit=1#order')","location.replace('https://threebyrd.com/?plan=weekly#order')");
 if(file==='client.js')text=`if(location.pathname==='/weekly-signup'&&location.hash.startsWith('#draft=')){try{const value=decodeURIComponent(location.hash.slice(7));if(value.length>12000)throw Error('Draft too large');const draft=JSON.parse(value);if(!draft?.cart?.length)throw Error('Invalid draft');sessionStorage.setItem('weeklyDraft',JSON.stringify(draft));history.replaceState(null,'','/weekly-signup')}catch{history.replaceState(null,'','/weekly-signup')}}\n`+text;
 await writeFile(root+'/weekly-review/'+file,text);
}
console.log('Production management assets prepared. Billing remains disabled.');
