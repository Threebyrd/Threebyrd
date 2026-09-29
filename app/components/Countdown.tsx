"use client";

import { useEffect, useState } from "react";
import {
  formatBusinessDateTime,
  getNextOrderCutoff,
  getDeliveryDayForCutoff,
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
          return { cutoff: getNextOrderCutoff(new Date(now)), now };
        }
        return { ...current, now };
      });
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = getCountdownParts(state.cutoff, state.now);
  const statusLabel = "Next delivery cutoff";
  const delivery = getDeliveryDayForCutoff(state.cutoff);

  return (
    <div className="summaryCountdown" aria-atomic="true" aria-live="polite">
      <div className="summarySchedule">
        <div><span>Order by</span><strong>{formatBusinessDateTime(state.cutoff)}</strong></div>
        <div><span>Delivery</span><strong>{delivery}</strong></div>
      </div>
      <p className="summaryCountdownRemaining" aria-label={`${statusLabel}: ${time.days} days, ${time.hours} hours, ${time.minutes} minutes, ${time.seconds} seconds`}>Next cutoff in {pad(time.days)}d {pad(time.hours)}h {pad(time.minutes)}m</p>
    </div>
  );
}
