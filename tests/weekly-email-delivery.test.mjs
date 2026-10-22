import test from 'node:test';import assert from 'node:assert/strict';
import {sendSetupEmail} from '../app/subscriptions/sandbox/email-delivery.mjs';
const accountId='4be3efc46385a4a26f3f303384bd97aa';
test('setup mail uses the approved sender, reply address, recipient and account only',async()=>{
 let sent;const result=await sendSetupEmail({accountId,token:'fixture',fetchImpl:async(url,request)=>{sent={url,message:JSON.parse(request.body)};return Response.json({success:true,result:{message_id:'test-receipt',queued:['luc@threebyrd.com']}});}});
 assert.equal(sent.message.from,'ThreeByrd Meal Prep <orders@threebyrd.com>');assert.equal(sent.message.reply_to,'luc@threebyrd.com');assert.deepEqual(sent.message.to,['luc@threebyrd.com']);assert.equal(result.status,'queued');
 await assert.rejects(()=>sendSetupEmail({accountId:'another-account',token:'fixture'}));
});
test('disabled, rejected, bounced or missing recipient is never reported as sent',async()=>{
 for(const body of [{success:false,errors:[{message:'email.sending.error.email.sending_disabled'}]},{success:true,result:{message_id:'test',permanent_bounces:['luc@threebyrd.com']}},{success:true,result:{message_id:'test',queued:['other@example.test']}},{success:true,result:{}}])await assert.rejects(()=>sendSetupEmail({accountId,token:'fixture',fetchImpl:async()=>Response.json(body)}));
});
