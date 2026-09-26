"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Countdown from "./Countdown";
import DeliveryAddressForm, { type DeliveryCheckState } from "./DeliveryAddressForm";
import MacroSnapshot from "./MacroSnapshot";
import { isOrderCapacitySoldOut, type OrderCapacityAvailability } from "../capacity";
import { EMPTY_DELIVERY_ADDRESS, type DeliveryAddressField, type DeliveryAddressFields } from "../delivery-address";
import {
  CART_PRICING_TIERS,
  CART_PRICING_TIER_ORDER,
  formatCompactMoney,
  formatMoney,
  formatPricingTier,
  getNextPricingTier,
  MINIMUM_BOXES,
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
const deliveryEligibilityApiUrl = `${checkoutApiOrigin}/api/delivery-eligibility`;

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
  const [capacityError, setCapacityError] = useState(false);
  const [capacityOverrideBlocked, setCapacityOverrideBlocked] = useState(false);
  const [lastInteractedProductId, setLastInteractedProductId] = useState<ProductId | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressFields>(EMPTY_DELIVERY_ADDRESS);
  const [deliveryCheckState, setDeliveryCheckState] = useState<DeliveryCheckState>("idle");
  const [deliveryMessage, setDeliveryMessage] = useState("Check your address before checkout.");
  const [deliveryDriveMinutes, setDeliveryDriveMinutes] = useState<number | null>(null);
  const [checkedDeliveryAddressKey, setCheckedDeliveryAddressKey] = useState<string | null>(null);
  const deliveryCheckRequestRef = useRef(0);
  const orderSummaryRef = useRef<HTMLElement>(null);
  const productGridRef = useRef<HTMLDivElement>(null);
  const quote = useMemo(
    () => quoteOrder(Object.entries(quantities).map(([productId, quantity]) => ({ productId, quantity }))),
    [quantities],
  );
  const nextTier = getNextPricingTier(quote.totalBoxes);
  const nextTierProducts = nextTier
    ? products.filter((product) => (
      !quote.pricingTier
      || CART_PRICING_TIERS[nextTier.tier].prices[product.id] < CART_PRICING_TIERS[quote.pricingTier].prices[product.id]
    ))
    : [];
  const deliveryAddressKey = JSON.stringify(deliveryAddress);
  const orderingAvailable = ORDERS_OPEN && capacity?.ordersOpen === true;
  const capacityBlocked = capacityOverrideBlocked || isOrderCapacitySoldOut(capacity);
  const capacityRemaining = capacity?.enabled && capacity.remaining !== null ? capacity.remaining : null;
  const capacityShortfall = capacityRemaining === null ? 0 : Math.max(0, quote.totalBoxes - capacityRemaining);
  const deliveryEligible = deliveryCheckState === "eligible" && deliveryAddressKey === checkedDeliveryAddressKey;
  const pricingMilestones = [
    { value: 3, label: "Minimum" },
    { value: 5, label: "Lower prices" },
    { value: 10, label: "Best standard prices" },
  ];
  const funnelCopy = quote.totalBoxes < MINIMUM_BOXES
    ? {
      current: quote.totalBoxes === 0 ? "Start your order" : `${quote.totalBoxes} meal${quote.totalBoxes === 1 ? "" : "s"} selected`,
      prompt: `Add ${MINIMUM_BOXES - quote.totalBoxes} more ${MINIMUM_BOXES - quote.totalBoxes === 1 ? "meal" : "meals"} to start your order`,
      target: "",
    }
    : quote.totalBoxes < 5
      ? {
        current: "3-meal minimum met ✓",
        prompt: `Add ${5 - quote.totalBoxes} more ${5 - quote.totalBoxes === 1 ? "meal" : "meals"}`,
        target: "to unlock 5-meal pricing",
      }
      : quote.totalBoxes < 10
        ? {
          current: "5-meal pricing unlocked ✓",
          prompt: `Add ${10 - quote.totalBoxes} more ${10 - quote.totalBoxes === 1 ? "meal" : "meals"}`,
          target: "to unlock best standard pricing",
        }
        : {
          current: "Best standard pricing unlocked ✓",
          prompt: quote.totalBoxes >= 20 ? "Ordering for a group?" : "",
          target: quote.totalBoxes >= 20 ? "Contact us for custom pricing" : "",
        };
  const mobileCartHint = quote.totalBoxes < MINIMUM_BOXES
    ? `Add ${MINIMUM_BOXES - quote.totalBoxes} more to start`
    : quote.totalBoxes < 5
      ? `Add ${5 - quote.totalBoxes} more → better pricing`
      : quote.totalBoxes < 10
        ? `Add ${10 - quote.totalBoxes} more → best pricing`
        : "Best pricing ✓";

  const refreshCapacity = useCallback(async (): Promise<OrderCapacityAvailability | null> => {
    try {
      const response = await fetch(capacityApiUrl, { headers: { accept: "application/json" } });
      if (!response.ok) {
        throw new Error("Capacity request failed.");
      }
      const nextCapacity = await response.json() as OrderCapacityAvailability;
      setCapacity(nextCapacity);
      setCapacityError(false);
      if (!isOrderCapacitySoldOut(nextCapacity)) {
        setCapacityOverrideBlocked(false);
      }
      return nextCapacity;
    } catch {
      setCapacityError(true);
      return null;
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void refreshCapacity(), 0);
    const timer = window.setInterval(() => void refreshCapacity(), 60_000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(timer);
    };
  }, [refreshCapacity]);

  function scrollToSummary() {
    const summary = orderSummaryRef.current;
    if (!summary) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    summary.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }

  function scrollToProducts() {
    const grid = productGridRef.current;
    if (!grid) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    grid.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
  }

  function changeQuantity(productId: ProductId, delta: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.min(99, current[productId] + delta)),
    }));
    setLastInteractedProductId(productId);
    setStatusMessage("");
  }

  function handleDeliveryAddressChange(field: DeliveryAddressField, value: string) {
    deliveryCheckRequestRef.current += 1;
    setDeliveryAddress((current) => ({ ...current, [field]: value }));
    setCheckedDeliveryAddressKey(null);
    setDeliveryCheckState("idle");
    setDeliveryDriveMinutes(null);
    setDeliveryMessage("Check your address before checkout.");
  }

  async function checkDeliveryAddress() {
    const requestId = ++deliveryCheckRequestRef.current;
    const requestAddress = { ...deliveryAddress };
    const requestAddressKey = JSON.stringify(requestAddress);
    setDeliveryCheckState("checking");
    setDeliveryMessage("");
    setDeliveryDriveMinutes(null);

    try {
      const response = await fetch(deliveryEligibilityApiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: requestAddress }),
      });
      const body = await response.json().catch(() => ({})) as { normalizedAddress?: unknown; driveMinutes?: unknown; error?: unknown };
      if (requestId !== deliveryCheckRequestRef.current) return;
      if (!response.ok || typeof body.normalizedAddress !== "string") {
        setDeliveryCheckState(response.status === 503 ? "unavailable" : "ineligible");
        setDeliveryMessage(typeof body.error === "string" ? body.error : "We could not verify that delivery address.");
        return;
      }

      setCheckedDeliveryAddressKey(requestAddressKey);
      setDeliveryDriveMinutes(typeof body.driveMinutes === "number" ? body.driveMinutes : null);
      setDeliveryCheckState("eligible");
      setDeliveryMessage("");
    } catch {
      if (requestId !== deliveryCheckRequestRef.current) return;
      setDeliveryCheckState("unavailable");
      setDeliveryMessage("The delivery checker is temporarily unavailable. Please try again.");
    }
  }

  async function handleCheckout() {
    if (!ORDERS_OPEN) {
      setStatusMessage("Checkout is temporarily unavailable. Please try again later.");
      return;
    }

    if (!quote.isValid) {
      setStatusMessage(quote.errors[0] ?? "Add meals to continue.");
      return;
    }

    if (!capacity) {
      setStatusMessage("Checkout availability is temporarily unavailable. Refresh and try again.");
      void refreshCapacity();
      return;
    }

    if (!capacity.ordersOpen) {
      setStatusMessage("Checkout is temporarily unavailable. Please try again later.");
      return;
    }

    if (capacityBlocked) {
      setStatusMessage("Checkout capacity is temporarily unavailable. Please adjust your cart and try again.");
      return;
    }

    if (capacityShortfall > 0) {
      setStatusMessage(`This cart exceeds the available checkout capacity. Remove ${capacityShortfall} ${capacityShortfall === 1 ? "box" : "boxes"} to continue.`);
      return;
    }

    if (!deliveryEligible) {
      setStatusMessage("Check your Ithaca delivery address before checkout.");
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
          deliveryAddress,
        }),
      });
      const body = await response.json().catch(() => ({})) as { code?: unknown; error?: unknown; url?: unknown };
      if (!response.ok) {
        if (body.code === "CAPACITY_EXHAUSTED") {
          setCapacityOverrideBlocked(true);
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
            <h2 className="majorHeading" id="order-title">Pick your<br /><em>meals.</em></h2>
          </div>
          <div className="orderIntroCopy">
            <p>Minimum 3 · Better pricing at 5 · Best pricing at 10</p>
          </div>
        </div>

        <div className="orderFunnel" aria-label="Pricing milestones">
          <div className="orderFunnelHeader">
            <strong>{funnelCopy.current}</strong>
            {funnelCopy.prompt && <span>{funnelCopy.prompt} {funnelCopy.target}</span>}
          </div>
          <div className="orderFunnelMilestones">
            {pricingMilestones.map((milestone) => {
              const complete = quote.totalBoxes >= milestone.value;
              const next = !complete && pricingMilestones.find((item) => quote.totalBoxes < item.value)?.value === milestone.value;
              return (
                <div className={`funnelMilestone${complete ? " isComplete" : ""}${next ? " isNext" : ""}`} key={milestone.value}>
                  <strong>{milestone.value}</strong>
                  <span>{milestone.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {quote.totalBoxes > 0 && (
          <button
            className="mobileCartControl"
            type="button"
            onClick={scrollToSummary}
            aria-label={`Review your order: ${quote.totalBoxes} ${quote.totalBoxes === 1 ? "meal" : "meals"}, ${formatMoney(quote.subtotalCents)}`}
          >
            <span className="mobileCartIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 5h2l1.4 9.1a2 2 0 0 0 2 1.7h7.8a2 2 0 0 0 1.9-1.4L21 8H7" /><circle cx="10" cy="19" r="1" /><circle cx="18" cy="19" r="1" /></svg>
            </span>
            <span className="mobileCartDetails"><strong>{quote.totalBoxes} {quote.totalBoxes === 1 ? "meal" : "meals"} · {formatMoney(quote.subtotalCents)}</strong><small>{mobileCartHint}</small></span>
            <span className="mobileCartArrow" aria-hidden="true">↓</span>
          </button>
        )}

        <div className="orderLayout">
          <div className="productColumn">
              <div className="productGrid" aria-label="Available meals" ref={productGridRef}>
              {products.map((product) => {
                const quantity = quantities[product.id];
                const disabled = !product.purchasable;
                const priceRange = priceRangeFor(product);
                return (
                  <Fragment key={product.id}>
                    <article className={`productCard productCard${product.protein} productCard-${product.id}${disabled ? " isComingSoon" : ""}`}>
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
                            <div className="productPriceRange" aria-label={`${product.name}: ${formatCompactMoney(priceRange.lowestCents)} to ${formatCompactMoney(priceRange.highestCents)} per meal based on total order size`}>
                              <strong>{formatCompactMoney(priceRange.lowestCents)} → {formatCompactMoney(priceRange.highestCents)}</strong>
                              <span>/ meal</span>
                              <small>based on total order size</small>
                            </div>
                          ) : <strong>—</strong>}
                        </div>
                        <MacroSnapshot product={product} />
                        {disabled ? (
                          <p className="productAvailability">Not available for purchase yet.</p>
                        ) : (
                          <div className="quantityControl" aria-label={`Quantity for ${product.name}`}>
                            <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)} disabled={!orderingAvailable || quantity === 0}>−</button>
                            <output aria-live="polite">{quantity}</output>
                            <button type="button" aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product.id, 1)} disabled={!orderingAvailable || quantity >= 99}>+</button>
                          </div>
                        )}
                      </div>
                    </article>
                    {lastInteractedProductId === product.id && quote.totalBoxes > 0 && (
                      <div className="mobileCartProgress" role="status" aria-live="polite">
                        <strong>{funnelCopy.current}</strong>
                        {funnelCopy.prompt && <span>{funnelCopy.prompt} {funnelCopy.target}</span>}
                        {quote.totalBoxes >= MINIMUM_BOXES && orderingAvailable && !capacityBlocked && capacityShortfall === 0 && (
                          <button type="button" onClick={scrollToSummary}>Review &amp; checkout <span aria-hidden="true">→</span></button>
                        )}
                        {quote.totalBoxes >= MINIMUM_BOXES && (!orderingAvailable || capacityBlocked || capacityShortfall > 0) && <span>Checkout is temporarily unavailable. Please try again later.</span>}
                        {quote.totalBoxes > 0 && quote.totalBoxes < MINIMUM_BOXES && <button type="button" onClick={scrollToProducts}>Keep building <span aria-hidden="true">↓</span></button>}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>

            <section className="pricingExplainer" aria-labelledby="pricing-explainer-title">
              <p className="sectionLabel">Cart-wide pricing</p>
              <h3 id="pricing-explainer-title">More meals = lower prices.</h3>
              <p className="pricingIntro">One cart. One tier. Mix and match freely.</p>
              <ol className="pricingSteps" aria-label="Cart pricing milestones">
                <li><strong>3 meals</strong><span>start here</span></li>
                <li><strong>5 meals</strong><span>lower prices</span></li>
                <li><strong>10 meals</strong><span>best standard prices</span></li>
                <li><strong>20+</strong><span><a href="mailto:thor@threebyrd.com?subject=20%2B%20Meal%20Custom%20Pricing">group order?</a></span></li>
              </ol>
              <details className="pricingDisclosure">
                <summary>See exact prices</summary>
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

          <aside ref={orderSummaryRef} id="order-summary" className="orderSummary" aria-labelledby="summary-title">
            <div className="summaryHeader">
              <div>
                <p className="sectionLabel">Your order</p>
                <h3 id="summary-title">Review + checkout</h3>
              </div>
              <span className="boxCount">{quote.totalBoxes} {quote.totalBoxes === 1 ? "meal" : "meals"}</span>
            </div>
            <Countdown initialCutoffIso={initialCutoffIso} />
            {quote.lines.length > 0 ? (
              <div className="summaryLines">
                {quote.lines.map((line) => (
                  <div className="summaryLine" key={line.productId}>
                    <div className="summaryLineInfo">
                      <strong>{line.name}</strong>
                      <span>{line.quantity} × {formatCompactMoney(line.unitAmountCents)}</span>
                    </div>
                    <div className="summaryLineActions">
                      <div className="summaryQuantityControl" aria-label={`Quantity for ${line.name}`}>
                        <button type="button" aria-label={`Remove one ${line.name}`} onClick={() => changeQuantity(line.productId, -1)} disabled={!orderingAvailable}>−</button>
                        <output aria-live="polite">{line.quantity}</output>
                        <button type="button" aria-label={`Add one ${line.name}`} onClick={() => changeQuantity(line.productId, 1)} disabled={!orderingAvailable || line.quantity >= 99}>+</button>
                      </div>
                      <b>{formatMoney(line.amountCents)}</b>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="summaryEmpty">Your mix of Chicken and Beef will show up here.</p>
            )}
            <div className="cartUpsell" role="status" aria-live="polite">
              <strong>{funnelCopy.current}</strong>
              {funnelCopy.prompt && <p>{funnelCopy.prompt} {funnelCopy.target}</p>}
              {nextTier && quote.totalBoxes >= MINIMUM_BOXES && nextTierProducts.length > 0 && <div className="cartUpsellPrices">
                {nextTierProducts.map((product) => (
                  <span key={product.id}><small>{product.name}</small><b>{formatCompactMoney(CART_PRICING_TIERS[nextTier.tier].prices[product.id])}</b></span>
                ))}
              </div>}
              {quote.totalBoxes < MINIMUM_BOXES && <button type="button" className="cartBuildButton" onClick={scrollToProducts}>Choose meals <span aria-hidden="true">↓</span></button>}
              {quote.totalBoxes >= 20 && <a className="cartGroupLink" href="mailto:thor@threebyrd.com?subject=20%2B%20Meal%20Custom%20Pricing">Contact us for group pricing →</a>}
            </div>
            <div className="summaryTotal">
              <div className="summaryTotalRow"><span>Meal subtotal</span><strong>{formatMoney(quote.subtotalCents)}</strong></div>
              <div className="summaryTotalRow"><span>Delivery</span><strong>$0</strong></div>
              <div className="summaryTotalFinal"><span>Total</span><strong>{formatMoney(quote.subtotalCents)}</strong></div>
            </div>
            <DeliveryAddressForm
              address={deliveryAddress}
              state={deliveryCheckState}
              message={deliveryMessage}
              driveMinutes={deliveryDriveMinutes}
              onAddressChange={handleDeliveryAddressChange}
              onCheck={() => void checkDeliveryAddress()}
            />
            <p className="deliveryNote"><span aria-hidden="true">✦</span> FREE DELIVERY IN ITHACA</p>
            <button className="checkoutButton" type="button" onClick={handleCheckout} disabled={!quote.isValid || !orderingAvailable || isSubmitting || !capacity || capacityBlocked || capacityShortfall > 0 || !deliveryEligible}>
              {isSubmitting ? "Opening secure checkout…" : !capacity ? capacityError ? "Retry checkout availability" : "Checking checkout availability…" : capacityShortfall > 0 ? `Remove ${capacityShortfall} ${capacityShortfall === 1 ? "box" : "boxes"} to continue` : capacityBlocked ? "Adjust cart to continue" : !ORDERS_OPEN || capacity.ordersOpen === false ? "Checkout temporarily unavailable" : !deliveryEligible ? "Check delivery address" : "Continue to secure checkout"}
              <span aria-hidden="true">→</span>
            </button>
            {statusMessage && <p className="checkoutStatus hasMessage" role="alert" aria-live="polite">{statusMessage}</p>}
          </aside>
        </div>
      </div>
    </section>
  );
}
