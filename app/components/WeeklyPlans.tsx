"use client";

import Image from "next/image";
import { useState } from "react";

const plans = [3, 5, 10, 20];

export default function WeeklyPlans() {
  const [selectedMeals, setSelectedMeals] = useState<number | null>(null);

  return (
    <section id="plans" className="plansSection" aria-labelledby="plans-title">
      <div className="sectionShell plansLayout">
        <div className="plansVisual" aria-label="A selection of Threebyrd meal prep boxes">
          <div className="plansPhoto plansPhotoMain">
            <Image
              src="/assets/hero-meal.webp"
              alt="Chicken and beef meal prep boxes with rice and broccoli"
              width={1000}
              height={1333}
              sizes="(max-width: 1024px) 100vw, 44vw"
            />
          </div>
          <div className="plansPhoto plansPhotoInset">
            <Image
              src="/assets/big-chicken.webp"
              alt="Big Chicken meal prep boxes"
              width={720}
              height={960}
              sizes="(max-width: 640px) 42vw, 220px"
            />
          </div>
          <span className="sticker stickerPlans">Build your week</span>
        </div>

        <div className="plansConfigurator">
          <div className="plansIntro">
            <p className="sectionLabel">Weekly Plans</p>
            <h2 id="plans-title">Pick your weekly rhythm.</h2>
            <p>Choose 3, 5, 10, or 20 meals. Final plan pricing is coming soon.</p>
          </div>
          <div className="planGrid" aria-label="Weekly meal plan options">
            {plans.map((meals) => {
              const selected = selectedMeals === meals;
              return (
                <article className={`planCard${selected ? " isSelected" : ""}`} key={meals}>
                  <p className="planMealCount"><strong>{meals}</strong><span>Meals / week</span></p>
                  <div className="planPriceDetails">
                    <p><span>Weekly price</span><strong>Coming soon</strong></p>
                    <p><span>Price per meal</span><strong>Coming soon</strong></p>
                    <p><span>Savings</span><strong>Coming soon</strong></p>
                  </div>
                  <button
                    aria-pressed={selected}
                    className="planSelectButton"
                    onClick={() => setSelectedMeals(meals)}
                    type="button"
                  >
                    {selected ? `${meals} meals selected` : `Select ${meals} meals`}
                  </button>
                </article>
              );
            })}
          </div>
          <p className="planSelection" aria-live="polite">
            {selectedMeals ? `${selectedMeals}-meal weekly plan selected.` : "Select a weekly plan to preview your choice."}
          </p>
        </div>
      </div>
    </section>
  );
}
