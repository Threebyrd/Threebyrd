export const ORDER_EMAIL_FROM='ThreeByrd Meal Prep <orders@threebyrd.com>';
export const ORDER_EMAIL_REPLY_TO='luc@threebyrd.com';
export const TEST_EMAIL_RECIPIENT='luc@threebyrd.com';

/** Test-only transport. Customer distribution remains disabled during sandbox review. */
export async function sendSetupEmail({accountId,token,fetchImpl=fetch}){
 if(accountId!=='4be3efc46385a4a26f3f303384bd97aa'||!token)throw new Error('The authorized ThreeByrd Cloudflare account is required.');
 const message={from:ORDER_EMAIL_FROM,to:[TEST_EMAIL_RECIPIENT],reply_to:ORDER_EMAIL_REPLY_TO,subject:'ThreeByrd email setup test',text:'This is a ThreeByrd email setup test. No order was placed and no payment was made.\n\nSender: orders@threebyrd.com\nReplies: luc@threebyrd.com'};
 return sendSandboxEmail({accountId,token,fetchImpl,message});
}

export async function sendSandboxEmail({accountId,token,fetchImpl=fetch,message}){
 if(accountId!=='4be3efc46385a4a26f3f303384bd97aa'||!token||message.from!==ORDER_EMAIL_FROM||message.reply_to!==ORDER_EMAIL_REPLY_TO||message.to?.length!==1||message.to[0]!==TEST_EMAIL_RECIPIENT)throw new Error('Only the approved sandbox sender and recipient are allowed.');
 const response=await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(message),signal:AbortSignal.timeout(15000)});
 let body;try{body=await response.json();}catch{throw new Error('Email service returned an unreadable response.');}
 if(!response.ok||body.success!==true){const disabled=body.errors?.some(e=>e.message==='email.sending.error.email.sending_disabled');throw new Error(disabled?'Cloudflare outbound Email Sending is not enabled on this account.':'Cloudflare did not accept the setup email.');}
 const result=body.result;
 if(!result?.message_id)throw new Error('No message receipt returned.');
 const blocked=[...(result.permanent_bounces??[]),...(result.suppressed_recipients??[])];
 if(blocked.includes(TEST_EMAIL_RECIPIENT))throw new Error('The setup email was bounced or suppressed.');
 if(!(result.delivered??[]).includes(TEST_EMAIL_RECIPIENT)&&!(result.queued??[]).includes(TEST_EMAIL_RECIPIENT))throw new Error('The approved recipient was not accepted.');
 return {messageId:result.message_id,status:(result.delivered??[]).includes(TEST_EMAIL_RECIPIENT)?'delivered':'queued',to:TEST_EMAIL_RECIPIENT,from:ORDER_EMAIL_FROM,replyTo:ORDER_EMAIL_REPLY_TO};
}
