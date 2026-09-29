"use client";

import { useSyncExternalStore } from "react";
import { formatBusinessDate } from "../order-config";

function subscribe() { return () => {}; }

function deliveryLabel() {
  // Display-only context from the server-created Checkout return URL. Fulfillment
  // continues to use persisted Stripe metadata, never this query parameter.
  const value = new URLSearchParams(window.location.search).get("delivery_date");
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
  return `${formatBusinessDate(date)} delivery`;
}

export default function ConfirmationDelivery() {
  const label = useSyncExternalStore(subscribe, deliveryLabel, () => "");
  return <strong>{label || "Delivery date assigned at checkout"}</strong>;
}
