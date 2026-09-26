"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const slides = [
  { src: "/assets/hero-big-chicken.jpg", alt: "Big Chicken meal prep box with rice and broccoli" },
  { src: "/assets/hero-big-beef.jpg", alt: "Big Beef meal prep box with rice and broccoli" },
] as const;

export default function HeroCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="heroCarousel" role="region" aria-label="ThreeByrd meal photos" aria-roledescription="carousel">
      {slides.map((slide, index) => (
        <Image
          className={`heroCarouselSlide${index === activeSlide ? " isActive" : ""}`}
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          width={2400}
          height={1600}
          sizes="(max-width: 1024px) 100vw, 48vw"
          priority={index === 0}
          aria-hidden={index !== activeSlide}
        />
      ))}
      <span className="heroCarouselStatus" aria-live="polite">{activeSlide + 1} / {slides.length}</span>
    </div>
  );
}
