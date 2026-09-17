"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Countdown from "./Countdown";
import MacroSnapshot from "./MacroSnapshot";
import { formatOrderCapacityMessage, isOrderCapacitySoldOut, type OrderCapacityAvailability } from "../capacity";
import {
  CART_PRICING_TIERS,
  CART_PRICING_TIER_ORDER,
  formatCompactMoney,
  formatMoney,
  formatPricingTier,
  getNextPricingTier,
  ORDERS_OPEN,
  priceRangeFor,
  products,
  quoteOrder,
  unitAmountAtTier,
  type ProductId,
} from "../order-config";

type OrderBuilderProps = {
  initialCutoffIso: string;
  checkoutMessage?: string;
};

const initialQuantities = Object.fromEntries(products.map((product) => [product.id, 0])) as Record<ProductId, number>;
const checkoutApiOrigin = (process.env.NEXT_PUBLIC_CHECKOUT_API_ORIGIN ?? "").trim().replace(/\/$/, "");
const checkoutApiUrl = `${checkoutApiOrigin}/api/checkout`;
const capacityApiUrl = `${checkoutApiOrigin}/api/capacity`;

export default function OrderBuilder({ initialCutoffIso, checkoutMessage }: OrderBuilderProps) {
  const searchParams = useSearchParams();
  const [quantities, setQuantities] = useState<Record<ProductId, number>>(initialQuantities);
  const [statusMessage, setStatusMessage] = useState(() => (
    checkoutMessage ?? (searchParams.get("checkout") === "canceled"
      ? "Checkout was canceled. Your order is still here whenever you are ready."
      : "")
  ));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capacity, setCapacity] = useState<OrderCapacityAvailability | null>(null);
  const [capacityOverrideSoldOut, setCapacityOverrideSoldOut] = useState(false);
  const [now, setNow] = useState(() => new Date(initialCutoffIso).getTime());
  const quote = useMemo(
    () => quoteOrder(Object.entries(quantities).map(([productId, quantity]) => ({ productId, quantity }))),
    [quantities],
  );
  const nextTier = getNextPricingTier(quote.totalBoxes);
  const orderWindowOpen = new Date(initialCutoffIso).getTime() >= now;
  const orderingAvailable = ORDERS_OPEN && orderWindowOpen;
  const capacitySoldOut = capacityOverrideSoldOut || isOrderCapacitySoldOut(capacity);

  const refreshCapacity = useCallback(async (): Promise<OrderCapacityAvailability | null> => {
    try {
      const response = await fetch(capacityApiUrl, { headers: { accept: "application/json" } });
      if (!response.ok) {
        throw new Error("Capacity request failed.");
      }
      const nextCapacity = await response.json() as OrderCapacityAvailability;
      setCapacity(nextCapacity);
      if (!isOrderCapacitySoldOut(nextCapacity)) {
        setCapacityOverrideSoldOut(false);
      }
      return nextCapacity;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void refreshCapacity(), 0);
    const timer = window.setInterval(() => void refreshCapacity(), 60_000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(timer);
    };
  }, [refreshCapacity]);

  function changeQuantity(productId: ProductId, delta: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.min(99, current[productId] + delta)),
    }));
    setStatusMessage("");
  }

  async function handleCheckout() {
    if (!ORDERS_OPEN) {
      setStatusMessage("Ordering will be opening soon.");
      return;
    }

    if (!quote.isValid) {
      setStatusMessage(quote.errors[0] ?? "Add meals to continue.");
      return;
    }

    if (!orderWindowOpen) {
      setStatusMessage("This order window has closed. Refresh the page for the next Friday cutoff.");
      return;
    }

    if (capacitySoldOut) {
      setStatusMessage("Sold out for this week. Please check back for the next ordering window.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const response = await fetch(checkoutApiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: quote.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        }),
      });
      const body = await response.json().catch(() => ({})) as { code?: unknown; error?: unknown; url?: unknown };
      if (!response.ok) {
        if (body.code === "CAPACITY_EXHAUSTED") {
          setCapacityOverrideSoldOut(true);
          void refreshCapacity();
        }
        throw new Error(typeof body.error === "string" ? body.error : "Checkout is temporarily unavailable.");
      }
      if (typeof body.url !== "string") {
        throw new Error("Checkout did not return a destination. Please try again.");
      }
      window.location.assign(body.url);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <section id="order" className="orderSection" aria-labelledby="order-title">
      <div className="sectionShell">
        <div className="orderIntro">
          <div>
            <p className="sectionLabel">Build your order</p>
            <h2 className="majorHeading" id="order-title">Chicken.<br />Beef.<br /><em>Your call.</em></h2>
          </div>
          <div className="orderIntroCopy">
            <p>Choose Little or Big, mix and match across proteins, and get your meals delivered to your door Saturday.</p>
            <p className="orderRule"><strong>3-box minimum.</strong> Mix and match however you want.</p>
          </div>
        </div>

        <div className="orderLayout">
          <div className="productColumn">
            <div className="productGrid" aria-label="Available meals">
              {products.map((product) => {
                const quantity = quantities[product.id];
                const disabled = !product.purchasable;
                const line = quote.lines.find((item) => item.productId === product.id);
                const priceRange = priceRangeFor(product);
                return (
                  <article className={`productCard productCard${product.protein} productCard-${product.id}${disabled ? " isComingSoon" : ""}`} key={product.id}>
                    <div className="productPhoto">
                      <Image src={product.image} alt={product.alt} width={1800} height={1200} sizes="(max-width: 720px) 100vw, 25vw" />
                      {disabled && <span className="comingSoonBadge">Coming soon</span>}
                    </div>
                    <div className="productCardBody">
                      <div className="productHeading">
                        <div>
                          <p className="productProtein">{product.protein}</p>
                          <h3>{product.name}</h3>
                        </div>
                        {priceRange ? (
                          <div className="productPriceRange" aria-label={`${product.name} price range ${formatCompactMoney(priceRange.highestCents)} to ${formatCompactMoney(priceRange.lowestCents)} per meal`}>
                            <strong>{formatCompactMoney(priceRange.highestCents)} → {formatCompactMoney(priceRange.lowestCents)}</strong>
                            <span>/ meal</span>
                            <small>depending on total cart size</small>
                          </div>
                        ) : <strong>—</strong>}
                      </div>
                      <p className="productDescription">{product.description}</p>
                      <MacroSnapshot product={product} />
                      {disabled ? (
                        <p className="productAvailability">Not available for purchase yet.</p>
                      ) : (
                        <div className="quantityControl" aria-label={`Quantity for ${product.name}`}>
                          <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)} disabled={!ORDERS_OPEN || quantity === 0}>−</button>
                          <output aria-live="polite">{quantity}</output>
                          <button type="button" aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product.id, 1)} disabled={!ORDERS_OPEN || quantity >= 99}>+</button>
                        </div>
                      )}
                      {line && line.pricingTier !== "3-4" && <p className="discountNote">{formatPricingTier(line.pricingTier)} cart tier pricing applied</p>}
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="pricingExplainer" aria-labelledby="pricing-explainer-title">
              <p className="sectionLabel">Cart-wide pricing</p>
              <h3 id="pricing-explainer-title">Order more. Pay less per meal.</h3>
              <p className="pricingIntro">Mix and match any meals — your total cart size determines the price of every meal.</p>
              <ol className="pricingSteps" aria-label="Cart pricing tiers">
                {CART_PRICING_TIER_ORDER.map((tier) => (
                  <li key={tier}>
                    <strong>{formatPricingTier(tier)} meals</strong>
                    <span>{tier === "10+" ? "best standard price" : "cart tier"}</span>
                  </li>
                ))}
              </ol>
              <p className="pricingNote">Mix proteins and sizes freely. Every meal gets its corresponding price from the tier your full cart reaches.</p>
              <p className="pricingExample"><strong>Example:</strong> 3 Big Chicken + 2 Big Beef = 5 meals total, so both products receive 5–9 pricing.</p>
              <p className="customPricingNote">Ordering 20+ meals? <a href="mailto:thor@threebyrd.com?subject=20%2B%20Meal%20Custom%20Pricing">Reach out</a> for custom pricing.</p>
              <details className="pricingDisclosure">
                <summary>See all tier prices</summary>
                <div className="pricingTableWrap">
                  <table className="pricingTable">
                    <caption className="srOnly">Exact per-meal pricing by total cart size</caption>
                    <thead>
                      <tr>
                        <th scope="col">Meal</th>
                        {CART_PRICING_TIER_ORDER.map((tier) => <th scope="col" key={tier}>{formatPricingTier(tier)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id}>
                          <th scope="row">{product.name}</th>
                          {CART_PRICING_TIER_ORDER.map((tier) => (
                            <td key={tier}>{formatCompactMoney(unitAmountAtTier(product, tier) ?? 0)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          </div>

          <aside className="orderSummary" aria-labelledby="summary-title">
            <div className="summaryHeader">
              <div>
                <p className="sectionLabel">Your order</p>
                <h3 id="summary-title">Ready when you are.</h3>
              </div>
              <span className="boxCount">{quote.totalBoxes} {quote.totalBoxes === 1 ? "box" : "boxes"}</span>
            </div>
            <Countdown initialCutoffIso={initialCutoffIso} />
            <div className={`capacityIndicator${capacitySoldOut ? " isSoldOut" : ""}`} role="status" aria-live="polite">
              {capacity ? formatOrderCapacityMessage(capacity) : "Checking weekly capacity…"}
            </div>
            {quote.lines.length > 0 ? (
              <div className="summaryLines">
                {quote.lines.map((line) => (
                  <div className="summaryLine" key={line.productId}>
                    <div className="summaryLineInfo">
                      <strong>{line.name}</strong>
                      <span>{line.quantity} × {formatCompactMoney(line.unitAmountCents)}{quote.pricingTier ? ` · ${formatPricingTier(quote.pricingTier)} tier` : ""}</span>
                    </div>
                    <div className="summaryLineActions">
                      <div className="summaryQuantityControl" aria-label={`Quantity for ${line.name}`}>
                        <button type="button" aria-label={`Remove one ${line.name}`} onClick={() => changeQuantity(line.productId, -1)} disabled={!ORDERS_OPEN}>−</button>
                        <output aria-live="polite">{line.quantity}</output>
                        <button type="button" aria-label={`Add one ${line.name}`} onClick={() => changeQuantity(line.productId, 1)} disabled={!ORDERS_OPEN || line.quantity >= 99}>+</button>
                      </div>
                      <b>{formatMoney(line.amountCents)}</b>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="summaryEmpty">Your mix of Chicken and Beef will show up here.</p>
            )}
            <div className="nextTierMessage" role="status" aria-live="polite">
              {quote.pricingTier ? (
                <p className="nextTierCurrent">Current pricing: <strong>{formatPricingTier(quote.pricingTier)} meals</strong></p>
              ) : (
                <p className="nextTierCurrent">Pricing starts at <strong>3–4 meals</strong>.</p>
              )}
              {nextTier ? (
                <>
                  <p className="nextTierPrompt">Add <strong>{nextTier.mealsUntil} more {nextTier.mealsUntil === 1 ? "meal" : "meals"}</strong> to unlock <strong>{formatPricingTier(nextTier.tier)} pricing:</strong></p>
                  <div className="nextTierPrices">
                    {products.map((product) => (
                      <span key={product.id}>
                        <small>{product.name}</small>
                        <b>{formatCompactMoney(CART_PRICING_TIERS[nextTier.tier].prices[product.id])}</b>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="nextTierBest">Best standard pricing unlocked.</p>
              )}
            </div>
            {quote.totalBoxes >= 20 && <p className="customPricingNote summaryCustomPricing">Ordering 20+ meals? <a href="mailto:thor@threebyrd.com?subject=20%2B%20Meal%20Custom%20Pricing">Reach out</a> for custom pricing.</p>}
            <div className={`minimumStatus${quote.totalBoxes >= 3 ? " isComplete" : ""}`} role="status" aria-live="polite">
              {quote.totalBoxes >= 3
                ? "3-box minimum met."
                : `Add ${3 - quote.totalBoxes} more ${3 - quote.totalBoxes === 1 ? "box" : "boxes"} to reach the 3-box minimum.`}
            </div>
            <div className="summaryTotal">
              <div className="summaryTotalRow"><span>Meal subtotal</span><strong>{formatMoney(quote.subtotalCents)}</strong></div>
              <div className="summaryTotalRow"><span>Delivery</span><strong>$0</strong></div>
              <div className="summaryTotalFinal"><span>Total</span><strong>{formatMoney(quote.subtotalCents)}</strong></div>
            </div>
            <p className="deliveryNote"><span aria-hidden="true">✦</span> Free Saturday delivery to your door.</p>
            <button className="checkoutButton" type="button" onClick={handleCheckout} disabled={!quote.isValid || !orderingAvailable || isSubmitting || capacitySoldOut}>
              {isSubmitting ? "Opening secure checkout…" : capacitySoldOut ? "Sold out for this week" : !ORDERS_OPEN ? "Ordering closed" : !orderWindowOpen ? "Order window closed" : "Continue to secure checkout"}
              <span aria-hidden="true">→</span>
            </button>
            <p className={`checkoutStatus${statusMessage ? " hasMessage" : ""}`} role="alert" aria-live="polite">
              {statusMessage || (capacitySoldOut ? "Sold out for this week. Check back for the next ordering window." : !ORDERS_OPEN ? "Ordering will be opening soon. Check back for updates." : "Secure checkout collects your delivery details.")}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
