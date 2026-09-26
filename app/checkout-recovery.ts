type StripeCheckoutSessionExpirer = {
  checkout: {
    sessions: {
      expire(sessionId: string): Promise<unknown>;
    };
  };
};

/**
 * Expire a session whose reservation link failed. The reservation is retained
 * until its short TTL so a payment/webhook race can still reconcile by the
 * reservation ID in metadata. The normal expired-session webhook or cleanup
 * releases it afterward.
 */
export async function expireCreatedCheckoutSession(
  stripe: StripeCheckoutSessionExpirer,
  sessionId: string,
): Promise<boolean> {
  try {
    await stripe.checkout.sessions.expire(sessionId);
    return true;
  } catch {
    return false;
  }
}
