"use client";

import { useEffect, useRef, useState } from "react";

const TARGET = 3000;
const DURATION_MS = 1500;

export default function CountUpTotal() {
  const targetRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      window.queueMicrotask(() => setValue(TARGET));
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || startedRef.current) return;
      startedRef.current = true;
      observer.disconnect();

      const startedAt = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / DURATION_MS);
        setValue(Math.round(TARGET * progress));
        if (progress < 1) {
          window.requestAnimationFrame(animate);
        }
      };

      window.requestAnimationFrame(animate);
    }, { threshold: 0.35 });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={targetRef} className="countUpValue" aria-live="off">
      <strong aria-hidden="true">${value.toLocaleString("en-US")}</strong>
      <span className="srOnly">$3,000</span>
    </div>
  );
}
