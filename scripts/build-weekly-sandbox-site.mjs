import { spawnSync } from 'node:child_process';
import { cp,mkdir,rm } from 'node:fs/promises';
import { resolve } from 'node:path';
// Build the existing website, enabling only the local order-mode UI. Never deploy.
const result=spawnSync(process.execPath,['scripts/build-github-pages.mjs'],{stdio:'inherit',env:{...process.env,PATH:`${resolve('node_modules/.bin')}:${process.env.PATH}`,GITHUB_PAGES_CUSTOM_DOMAIN:'http://localhost:3012',NEXT_PUBLIC_SITE_URL:'http://localhost:3012',NEXT_PUBLIC_CHECKOUT_API_ORIGIN:'',NEXT_PUBLIC_APPS_SCRIPT_URL:'http://localhost:3012/api/mock-join',NEXT_PUBLIC_WEEKLY_SANDBOX:'true'}});
if(result.status!==0)process.exit(result.status??1);
const target='.local-previews/weekly-stage2/site';await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});await cp('dist/github-pages',target,{recursive:true});
console.log(`Local website sandbox built at ${resolve(target)}. No production deployment.`);
