// Reuse the current website's server-side delivery rules without copying secrets.
// Reads only: never creates a production checkout, reservation, or order.
const API='https://api.threebyrd.com';
export function websiteOrderChecks({fetchImpl=fetch}={}){
 async function read(path,body){
  const response=await fetchImpl(API+path,{method:body?'POST':'GET',headers:{accept:'application/json',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error('Website delivery checks are temporarily unavailable. No payment was started.');
  return response.json();
 }
 return {
  async address(address){
   const result=await read('/api/delivery-eligibility',{address});
   if(result.eligible!==true||!Number.isFinite(result.driveMinutes))throw new Error('This address is outside the current delivery area.');
   return result;
  },
  async preflight(snapshot){
   await this.address(snapshot.address);
   const capacity=await read('/api/capacity');
   if(capacity.ordersOpen!==true)throw new Error('Website ordering is currently closed.');
   // A read is not an atomic reservation. Fail closed if a cap is activated,
   // until weekly billing is wired to the same production reservation authority.
   if(capacity.enabled!==false||capacity.limit!==null)throw new Error('Shared capacity reservations require operator setup before weekly billing.');
   return {eligible:true,capacityEnabled:false};
  },
 };
}
