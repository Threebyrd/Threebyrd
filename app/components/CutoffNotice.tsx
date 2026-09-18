"use client";

import { useEffect, useState } from "react";
import { formatBusinessDateTime, getNextFridayCutoffAfter, getSaturdayForCutoff } from "../order-config";

type CutoffNoticeProps = {
  initialCutoffIso: string;
};

export default function CutoffNotice({ initialCutoffIso }: CutoffNoticeProps) {
  const [cutoff, setCutoff] = useState(() => new Date(initialCutoffIso));

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCutoff((current) => now.getTime() >= current.getTime() ? getNextFridayCutoffAfter(now) : current);
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <p className="footerCutoff">Orders close {formatBusinessDateTime(cutoff)} · next cook {getSaturdayForCutoff(cutoff)}</p>;
}
