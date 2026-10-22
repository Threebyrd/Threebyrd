// Read-only release preparation. Never loads credentials or deploys anything.
import {readFileSync} from 'node:fs';
const plan=JSON.parse(readFileSync('config/weekly-production-plan.json','utf8'));
const outstanding=Object.entries(plan.rollout).filter(([,verified])=>verified!==true).map(([name])=>name);
console.log(JSON.stringify({environment:plan.environment,billingEnabled:plan.billingEnabled,customerEmailsEnabled:plan.customerEmailsEnabled,readyForLiveLaunch:outstanding.length===0,outstanding,notice:'Preparation only. Test lifecycle success is not production deployment.'},null,2));
if(plan.billingEnabled||plan.customerEmailsEnabled)throw new Error('This prepared plan must remain disabled until live launch is implemented and verified.');
