"use client";

import { useEffect, useState } from "react";
import {
  BUSINESS_TIME_ZONE,
  formatBusinessDate,
  getNextFridayCutoffAfter,
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
  const closedCycle = state.now >= state.cutoff.getTime();

  return (
    <section className="countdownSection" aria-labelledby="countdown-title">
      <div className="sectionShell countdownLayout">
        <div>
          <p className="sectionLabel sectionLabelLight">Delivery cadence</p>
          <h2 id="countdown-title">Orders open until.</h2>
          <p className="countdownCopy">
            We cook on Saturday and deliver straight to your door. Order by Friday at 3:00 PM Eastern for the next cook.
          </p>
        </div>
        <div className="countdownPanel" aria-live="polite">
          <p>{closedCycle ? "Next order window" : "Time left to order"}</p>
          <strong>{formatBusinessDate(state.cutoff)}</strong>
          <div className="countdownDigits" aria-label={`${time.days} days, ${time.hours} hours, ${time.minutes} minutes, ${time.seconds} seconds`}>
            <span><b>{pad(time.days)}</b><small>days</small></span>
            <span><b>{pad(time.hours)}</b><small>hours</small></span>
            <span><b>{pad(time.minutes)}</b><small>minutes</small></span>
            <span><b>{pad(time.seconds)}</b><small>seconds</small></span>
          </div>
          <small className="countdownZone">3:00 PM · {BUSINESS_TIME_ZONE}</small>
        </div>
      </div>
    </section>
  );
}
