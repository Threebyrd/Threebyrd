"use client";

import { useEffect, useState } from "react";
import { formatBusinessDateTime, getNextOrderCutoff, getDeliveryDayForCutoff } from "../order-config";

type CutoffNoticeProps = {
  initialCutoffIso: string;
};

export default function CutoffNotice({ initialCutoffIso }: CutoffNoticeProps) {
  const [cutoff, setCutoff] = useState(() => new Date(initialCutoffIso));

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCutoff((current) => now.getTime() >= current.getTime() ? getNextOrderCutoff(now) : current);
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <p className="footerCutoff">Next delivery cutoff {formatBusinessDateTime(cutoff)} · delivery {getDeliveryDayForCutoff(cutoff)}</p>;
}
