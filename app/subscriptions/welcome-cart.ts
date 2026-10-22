import { getProduct } from "../order-config.ts";
import type { ProductId, SauceId } from "../order-config.ts";

export type SelectedMeal = { id: string; productId: ProductId; sauceId: SauceId };
/** First physical meal is the provisional first-delivery gift, never a paid-tier meal. */
export function splitWelcomeCart<T extends SelectedMeal>(selections: readonly T[], eligible: boolean, preferredGiftId?: string) {
  const gift = eligible ? selections.find((selection) => selection.id === preferredGiftId && getProduct(selection.productId)?.purchasable === true) ?? selections.find((selection) => getProduct(selection.productId)?.purchasable === true) ?? null : null;
  return { gift, paid: selections.filter((selection) => selection.id !== gift?.id) };
}
