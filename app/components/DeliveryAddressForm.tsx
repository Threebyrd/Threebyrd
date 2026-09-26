"use client";

export type DeliveryCheckState = "idle" | "checking" | "eligible" | "ineligible" | "unavailable";

type DeliveryAddressFormProps = {
  address: string;
  state: DeliveryCheckState;
  message: string;
  driveMinutes: number | null;
  onAddressChange: (value: string) => void;
  onCheck: () => void;
};

export default function DeliveryAddressForm({
  address,
  state,
  message,
  driveMinutes,
  onAddressChange,
  onCheck,
}: DeliveryAddressFormProps) {
  return (
    <section className="deliveryEligibility" aria-labelledby="delivery-address-title">
      <div className="deliveryEligibilityHeading">
        <p className="sectionLabel sectionLabelLight">Free delivery in Ithaca</p>
        <h4 id="delivery-address-title">Where should we deliver your meals?</h4>
        <p>Enter the address where this week&apos;s meals should go. We deliver within 20 minutes of our kitchen, and we&apos;ll use this verified address for delivery.</p>
      </div>
      <label htmlFor="delivery-address">Ithaca delivery address</label>
      <div className="deliveryAddressControls">
        <input
          id="delivery-address"
          name="delivery-address"
          type="text"
          autoComplete="street-address"
          inputMode="text"
          placeholder="Street, city, state, ZIP"
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          aria-describedby="delivery-address-help delivery-address-status"
        />
        <button type="button" onClick={onCheck} disabled={state === "checking" || address.trim().length < 8}>
          {state === "checking" ? "Checking…" : "Check address"}
        </button>
      </div>
      <p id="delivery-address-help" className="deliveryAddressHelp">Free delivery only · no delivery fee at checkout.</p>
      <p id="delivery-address-status" className={`deliveryAddressStatus is-${state}`} role="status" aria-live="polite">
        {state === "eligible" ? `✓ You’re in our free delivery area${driveMinutes ? ` · about ${driveMinutes} min away` : ""}.` : message}
      </p>
    </section>
  );
}
