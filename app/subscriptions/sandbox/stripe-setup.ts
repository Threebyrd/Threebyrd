import type Stripe from "stripe";

/** Checkout setup mode saves a method without charging; usage is verified on its SetupIntent. */
export function weeklySetupParams(baseUrl: string, customer: string, planId: string, customerId: string): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "setup", currency: "usd", customer, payment_method_types: ["card"],
    setup_intent_data: { metadata: { weekly_plan_id: planId, weekly_customer_id: customerId } },
    success_url: `${baseUrl}/my-plan?setup=returned`, cancel_url: `${baseUrl}/my-plan?setup=canceled`,
  };
}
