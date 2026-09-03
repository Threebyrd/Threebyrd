"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  ORDERS_OPEN,
  products,
  quoteOrder,
  type ProductId,
} from "../order-config";

type OrderBuilderProps = {
  initialCutoffIso: string;
  checkoutMessage?: string;
};

const initialQuantities = Object.fromEntries(products.map((product) => [product.id, 0])) as Record<ProductId, number>;

export default function OrderBuilder({ initialCutoffIso, checkoutMessage }: OrderBuilderProps) {
  const [quantities, setQuantities] = useState<Record<ProductId, number>>(initialQuantities);
  const [statusMessage, setStatusMessage] = useState(checkoutMessage ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date(initialCutoffIso).getTime());
  const quote = useMemo(
    () => quoteOrder(Object.entries(quantities).map(([productId, quantity]) => ({ productId, quantity }))),
    [quantities],
  );
  const orderWindowOpen = new Date(initialCutoffIso).getTime() > now;
  const orderingAvailable = ORDERS_OPEN && orderWindowOpen;

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

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

    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: quote.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: unknown; url?: unknown };
      if (!response.ok) {
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
            <h2 id="order-title">Chicken.<br />Beef.<br /><em>Your call.</em></h2>
          </div>
          <div className="orderIntroCopy">
            <p>Choose Little or Big, mix and match across proteins, and send three or more boxes to your door.</p>
            <p className="orderRule"><strong>3-box minimum.</strong> Mix and match however you want.</p>
          </div>
        </div>

        <div className="orderLayout">
          <div className="productGrid" aria-label="Available meals">
            {products.map((product) => {
              const quantity = quantities[product.id];
              const disabled = !product.purchasable;
              const line = quote.lines.find((item) => item.productId === product.id);
              return (
                <article className={`productCard productCard${product.protein}${disabled ? " isComingSoon" : ""}`} key={product.id}>
                  <div className="productPhoto">
                    <Image src={product.image} alt={product.alt} width={720} height={960} sizes="(max-width: 720px) 100vw, 25vw" />
                    {disabled && <span className="comingSoonBadge">Coming soon</span>}
                  </div>
                  <div className="productCardBody">
                    <div className="productHeading">
                      <div>
                        <p className="productProtein">{product.protein}</p>
                        <h3>{product.name}</h3>
                      </div>
                      <strong>{disabled ? "—" : formatMoney(product.regularUnitAmountCents ?? 0)}</strong>
                    </div>
                    <p className="productDescription">{disabled ? "We are putting the finishing touches on this recipe." : product.description}</p>
                    {product.calories && product.proteinGrams && (
                      <div className="macroStrip" aria-label={`${product.name} macros`}>
                        <span><b>{product.proteinGrams}</b> protein</span>
                        <span><b>{product.calories}</b> cal</span>
                      </div>
                    )}
                    {disabled ? (
                      <p className="productAvailability">Not available for purchase yet.</p>
                    ) : (
                      <div className="quantityControl" aria-label={`Quantity for ${product.name}`}>
                        <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)} disabled={!ORDERS_OPEN || quantity === 0}>−</button>
                        <output aria-live="polite">{quantity}</output>
                        <button type="button" aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product.id, 1)} disabled={!ORDERS_OPEN}>+</button>
                      </div>
                    )}
                    {line?.discountApplied && <p className="discountNote">5+ quantity pricing applied</p>}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="orderSummary" aria-labelledby="summary-title">
            <div className="summaryHeader">
              <div>
                <p className="sectionLabel">Your order</p>
                <h3 id="summary-title">Ready when you are.</h3>
              </div>
              <span className="boxCount">{quote.totalBoxes} {quote.totalBoxes === 1 ? "box" : "boxes"}</span>
            </div>
            {!ORDERS_OPEN && (
              <div className="closedOrderNotice" role="status">
                <strong>Orders are currently closed</strong>
                <span>Ordering will be opening soon.</span>
              </div>
            )}
            {quote.lines.length > 0 ? (
              <div className="summaryLines">
                {quote.lines.map((line) => (
                  <div className="summaryLine" key={line.productId}>
                    <div>
                      <strong>{line.name}</strong>
                      <span>{line.quantity} × {formatMoney(line.unitAmountCents)}{line.discountApplied ? " · 5+ price" : ""}</span>
                    </div>
                    <b>{formatMoney(line.amountCents)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="summaryEmpty">Your mix of Chicken and Beef will show up here.</p>
            )}
            <div className={`minimumStatus${quote.totalBoxes >= 3 ? " isComplete" : ""}`} role="status" aria-live="polite">
              {quote.totalBoxes >= 3
                ? "3-box minimum met."
                : `Add ${3 - quote.totalBoxes} more ${3 - quote.totalBoxes === 1 ? "box" : "boxes"} to reach the 3-box minimum.`}
            </div>
            <div className="summaryTotal"><span>Subtotal</span><strong>{formatMoney(quote.subtotalCents)}</strong></div>
            <p className="deliveryNote"><span aria-hidden="true">✦</span> Delivery only · Cooked and delivered Saturday.</p>
            <button className="checkoutButton" type="button" onClick={handleCheckout} disabled={!quote.isValid || !orderingAvailable || isSubmitting}>
              {isSubmitting ? "Opening secure checkout…" : !ORDERS_OPEN ? "Ordering closed" : !orderWindowOpen ? "Order window closed" : "Continue to secure checkout"}
              <span aria-hidden="true">→</span>
            </button>
            <p className={`checkoutStatus${statusMessage ? " hasMessage" : ""}`} role="alert" aria-live="polite">
              {statusMessage || (!ORDERS_OPEN ? "Ordering will be opening soon. Check back for updates." : "Secure checkout collects your delivery details.")}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
