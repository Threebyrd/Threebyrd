import {cp,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
const dest='.local-previews/weekly-hosted/site';
await mkdir(dest,{recursive:true});
await cp('.local-previews/weekly-stage2/site',dest,{recursive:true});
await mkdir(dest+'/weekly-review',{recursive:true});
for(const file of ['index.html','client.js','style.css']){
 let text=await readFile('scripts/weekly-sandbox/'+file,'utf8');
 text=text.replaceAll('Sandbox address checks use fictional test eligibility for Ithaca. Production delivery checks remain separate.','Delivery eligibility uses the same delivery-area checker as the current website.').replaceAll('LOCAL SANDBOX','HOSTED STAGING').replaceAll('NO CHARGES OR REAL EMAILS','NO LIVE CHARGES · TEST EMAILS TO LUC ONLY').replaceAll('Local testing: emails appear only in the private developer inbox opened beside this sandbox. Nothing is sent to a real mailbox.','Hosted testing: sign-in emails are enabled only for luc@threebyrd.com. This review site uses Stripe test payments and fictional orders.');
 await writeFile(dest+'/weekly-review/'+file,text);
}
const cssDir=dest+'/_next/static/css';
await writeFile(dest+'/site-theme.css',(await Promise.all((await readdir(cssDir)).filter(n=>n.endsWith('.css')).map(n=>readFile(cssDir+'/'+n,'utf8')))).join('\n'));
console.log('Hosted review assets prepared; production output unchanged.');

async function rewriteLocalLinks(dir){
 for(const item of await readdir(dir,{withFileTypes:true})){
  const path=dir+'/'+item.name;
  if(item.isDirectory())await rewriteLocalLinks(path);
  else if(/\.(html|js|json|rsc|txt|xml)$/.test(item.name)){
   const text=await readFile(path,'utf8');
   if(text.includes('http://localhost:3012'))await writeFile(path,text.replaceAll('http://localhost:3012','https://threebyrd-weekly-staging.thorbwag.workers.dev'));
  }
 }
}
await rewriteLocalLinks(dest);
