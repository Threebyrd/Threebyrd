"use client";

import {
  normalizeDeliveryAddressFields,
  type DeliveryAddressField,
  type DeliveryAddressFields,
  US_STATE_OPTIONS,
} from "../delivery-address";

export type DeliveryCheckState = "idle" | "checking" | "eligible" | "ineligible" | "unavailable";

type DeliveryAddressFormProps = {
  address: DeliveryAddressFields;
  state: DeliveryCheckState;
  message: string;
  driveMinutes: number | null;
  onAddressChange: (field: DeliveryAddressField, value: string) => void;
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
  const isComplete = normalizeDeliveryAddressFields(address) !== null;
  const describedBy = "delivery-address-help delivery-address-status";

  return (
    <section className="deliveryEligibility" aria-labelledby="delivery-address-title">
      <div className="deliveryEligibilityHeading">
        <p className="sectionLabel sectionLabelLight">Free delivery in Ithaca</p>
        <h4 id="delivery-address-title">Where should we deliver your meals?</h4>
        <p>Enter the address where this week&apos;s meals should go. We deliver within 20 minutes of our kitchen, and we&apos;ll use this verified address for delivery.</p>
      </div>
      <div className="deliveryAddressFields">
        <div className="deliveryField deliveryFieldWide">
          <label htmlFor="delivery-street">Street address</label>
          <input
            id="delivery-street"
            name="streetAddress"
            type="text"
            autoComplete="address-line1"
            inputMode="text"
            autoCapitalize="words"
            value={address.streetAddress}
            onChange={(event) => onAddressChange("streetAddress", event.target.value)}
            aria-describedby={describedBy}
          />
        </div>
        <div className="deliveryField deliveryFieldWide">
          <label htmlFor="delivery-city">City</label>
          <input
            id="delivery-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            inputMode="text"
            autoCapitalize="words"
            value={address.city}
            onChange={(event) => onAddressChange("city", event.target.value)}
            aria-describedby={describedBy}
          />
        </div>
        <div className="deliveryAddressFieldRow">
          <div className="deliveryField">
            <label htmlFor="delivery-state">State</label>
            <select
              id="delivery-state"
              name="state"
              autoComplete="address-level1"
              value={address.state}
              onChange={(event) => onAddressChange("state", event.target.value)}
              aria-describedby={describedBy}
            >
              <option value="">Select state</option>
              {US_STATE_OPTIONS.map(([code, label]) => <option value={code} key={code}>{label}</option>)}
            </select>
          </div>
          <div className="deliveryField">
            <label htmlFor="delivery-zip">ZIP code</label>
            <input
              id="delivery-zip"
              name="zipCode"
              type="text"
              autoComplete="postal-code"
              inputMode="numeric"
              autoCapitalize="characters"
              pattern="[0-9]{5}(-[0-9]{4})?"
              maxLength={10}
              value={address.zipCode}
              onChange={(event) => onAddressChange("zipCode", event.target.value)}
              aria-describedby={describedBy}
            />
          </div>
        </div>
      </div>
      <div className="deliveryAddressControls">
        <button type="button" onClick={onCheck} disabled={state === "checking" || !isComplete}>
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
