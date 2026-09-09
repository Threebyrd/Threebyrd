"use client";

import { useEffect, useState } from "react";
import {
  formatBusinessDate,
  getNextFridayCutoffAfter,
  ORDERS_OPEN,
} from "../order-config";

type CountdownProps = {
  initialCutoffIso: string;
};

type CountdownState = {
  cutoff: Date;
  now: number;
};

function getCountdownParts(cutoff: Date, now: number) {
  const remaining = Math.max(0, cutoff.getTime() - now);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export default function Countdown({ initialCutoffIso }: CountdownProps) {
  const [state, setState] = useState<CountdownState>(() => ({
    cutoff: new Date(initialCutoffIso),
    now: new Date(initialCutoffIso).getTime(),
  }));

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      setState((current) => {
        if (now >= current.cutoff.getTime()) {
          return { cutoff: getNextFridayCutoffAfter(new Date(now)), now };
        }
        return { ...current, now };
      });
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = getCountdownParts(state.cutoff, state.now);
  const closedCycle = state.now > state.cutoff.getTime();

  const statusLabel = !ORDERS_OPEN ? "Ordering opens in" : closedCycle ? "Next order window" : "Orders close in";

  return (
    <div className="summaryCountdown" aria-atomic="true" aria-live="polite">
      <div className="summaryCountdownHeader">
        <p>{statusLabel}</p>
        <span>{formatBusinessDate(state.cutoff)} · 3:00 PM ET</span>
      </div>
      <div className="summaryCountdownDigits" aria-label={`${statusLabel}: ${time.days} days, ${time.hours} hours, ${time.minutes} minutes, ${time.seconds} seconds`}>
        <span><b>{pad(time.days)}</b><small>days</small></span>
        <span><b>{pad(time.hours)}</b><small>hours</small></span>
        <span><b>{pad(time.minutes)}</b><small>minutes</small></span>
        <span><b>{pad(time.seconds)}</b><small>seconds</small></span>
      </div>
    </div>
  );
}
