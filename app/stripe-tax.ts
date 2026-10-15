// Kept as a documented fallback for callers that need a compile-time default.
// Production still reads STRIPE_PRODUCT_TAX_CODE from the Worker secret.
export const STRIPE_MEAL_TAX_CODE = "txcd_40060003";
export const STRIPE_MEAL_TAX_BEHAVIOR = "exclusive" as const;
