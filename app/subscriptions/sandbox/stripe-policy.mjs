export function stripeMode(environment){
 if(!['stripe_test','stripe_live'].includes(environment))throw new Error('Stripe payment storage required.');
 return environment==='stripe_live';
}
export function assertAdapter(store,adapter){
 const live=stripeMode(store.environment);
 if(!adapter||(live?adapter.environment!=='stripe_live':adapter.environment&&adapter.environment!=='stripe_test'))throw new Error('Payment adapter environment mismatch.');
 return live;
}
