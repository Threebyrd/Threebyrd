// Fresh production namespace only. Never migrate or open a staging database.
export function productionSchema(source){return source.replaceAll("'mock','stripe_test'","'stripe_live'")}
