"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

// The public site should expose the live weekly-plan entry point by default.
// Set NEXT_PUBLIC_WEEKLY_ENABLED=false only for an intentionally old/isolated preview.
export const WEEKLY_PRODUCTION_ORIGIN = process.env.NEXT_PUBLIC_WEEKLY_ENABLED !== "false" ? "https://weekly.threebyrd.com" : "";
export const WEEKLY_SANDBOX_ENABLED = process.env.NEXT_PUBLIC_WEEKLY_SANDBOX === "true" || !!WEEKLY_PRODUCTION_ORIGIN;

function subscribeToNavigation(listener: () => void) { window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); }

export default function WeeklyPlanMode() {
  const requestedWeekly = useSyncExternalStore(subscribeToNavigation, () => new URLSearchParams(window.location.search).get("plan") === "weekly", () => false);
  const [choice, setChoice] = useState<boolean | null>(null);
  const weekly = choice ?? requestedWeekly;
  const [welcomeEligible, setWelcomeEligible] = useState(true);
  const [cutoff, setCutoff] = useState<string | null>(null);
  useEffect(() => {
    if (!WEEKLY_SANDBOX_ENABLED) return;
    void fetch("/api/me").then((response) => response.ok ? response.json() : null).then((data) => { const state = data as { preview?: { welcomeEligible?: boolean } } | null; if (state?.preview?.welcomeEligible === false) setWelcomeEligible(false); }).catch(() => {});
    void fetch(`${WEEKLY_PRODUCTION_ORIGIN}/api/catalog`).then((response) => response.json()).then((data) => {
      const parsed = data as { calendar?: { status: string; cutoffAt: string }[] };
      const cycle = parsed.calendar?.find((item: { status: string; cutoffAt: string }) => item.status === "open" && Date.parse(item.cutoffAt) > Date.now());
      setCutoff(cycle?.cutoffAt ?? null);
    }).catch(() => setCutoff(null));
  }, []);
  useEffect(() => {
    if (WEEKLY_SANDBOX_ENABLED && weekly) window.dispatchEvent(new CustomEvent("threebyrd-order-mode", { detail: { weekly, cutoff, welcomeEligible } }));
  }, [weekly, cutoff, welcomeEligible]);
  if (!WEEKLY_SANDBOX_ENABLED) return null;
  function select(value: boolean) {
    setChoice(value);
    window.dispatchEvent(new CustomEvent("threebyrd-order-mode", { detail: { weekly: value, cutoff, welcomeEligible } }));
  }
  const deadline = cutoff ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(cutoff)) : "the displayed weekly cutoff";
  return <section className="weeklyModeSection sectionShell" aria-label="Choose order type">
    {!WEEKLY_PRODUCTION_ORIGIN && <p className="weeklyLocalNotice">Local preview · no payments or real deliveries</p>}
    <div className="weeklyModeButtons" role="group" aria-label="Order type">
      <button type="button" aria-pressed={!weekly} className={`weeklyModeButton${!weekly ? " isSelected" : ""}`} onClick={() => select(false)}>One-time order</button>
      <button type="button" aria-pressed={weekly} className={`weeklyModeButton weeklyOfferButton${weekly ? " isSelected" : ""}`} onClick={() => select(true)}><span>Weekly plan</span><strong className="weeklyOfferSticker">5% OFF + 1 FREE BOX<small>Free meal with your first paid weekly delivery</small></strong></button>
    </div>
    {weekly && <div className="weeklyModeDetails" role="status">
      <strong>Your meals. Your schedule.</strong>
      <ul className="weeklyStarList">
        <li>Pause your plan or skip a week anytime.</li>
        <li>Holiday breaks are skipped automatically.</li>
        <li>Change meals and sauces anytime before that week’s cutoff.</li>
        <li>Sign up for weekly meals: get one free box of any size with your first delivery and save 5% on your weekly meal orders.</li>
      </ul>
      <p className="weeklyModeCutoff">Next weekly-plan cutoff: <b>{deadline}</b>.</p>
      <a href={`${WEEKLY_PRODUCTION_ORIGIN}/my-plan`}>Already subscribed? Manage my plan →</a>
    </div>}

  </section>;
}
