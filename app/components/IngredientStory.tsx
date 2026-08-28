"use client";

import Image from "next/image";
import { useState } from "react";

const ingredients = [
  {
    id: "chicken",
    label: "Chicken",
    title: "Two chicken portions.",
    body: "Choose Little Chicken or Big Chicken. Each comes with its own verified macro panel.",
    image: "/assets/big-chicken.webp",
    alt: "Big Chicken meal prep boxes with rice and broccoli",
  },
  {
    id: "beef",
    label: "Beef",
    title: "A second protein option.",
    body: "Beef is available alongside rice and broccoli. The current menu shows the one verified beef macro set.",
    image: "/assets/big-beef.webp",
    alt: "Beef meal prep boxes with rice and broccoli",
  },
  {
    id: "rice",
    label: "Rice",
    title: "Rice in every box.",
    body: "Rice is included with every current Chicken and Beef meal option.",
    image: "/assets/little-chicken.webp",
    alt: "Chicken meal prep boxes served with white rice and broccoli",
  },
  {
    id: "broccoli",
    label: "Broccoli",
    title: "Broccoli in every box.",
    body: "Broccoli completes the current Threebyrd combination alongside protein and rice.",
    image: "/assets/little-beef.webp",
    alt: "Beef meal prep boxes served with white rice and broccoli",
  },
];

export default function IngredientStory() {
  const [activeId, setActiveId] = useState("chicken");
  const active = ingredients.find((ingredient) => ingredient.id === activeId) ?? ingredients[0];

  return (
    <section className="ingredientSection" aria-labelledby="ingredients-title">
      <div className="sectionShell ingredientLayout">
        <div className="ingredientCopy">
          <p className="sectionLabel">What Is In The Box</p>
          <h2 id="ingredients-title">Protein, rice, broccoli. That is the build.</h2>
          <p>Explore the core components of the current menu. Exact seasoning and allergen statements will be finalized before orders open.</p>
          <div className="ingredientTabs" role="group" aria-label="Meal components">
            {ingredients.map((ingredient) => (
              <button
                aria-pressed={activeId === ingredient.id}
                key={ingredient.id}
                onClick={() => setActiveId(ingredient.id)}
                type="button"
              >
                {ingredient.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ingredientVisual">
          <Image
            key={active.id}
            src={active.image}
            alt={active.alt}
            width={720}
            height={960}
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="ingredientNote" aria-live="polite">
            <span>{active.label}</span>
            <h3>{active.title}</h3>
            <p>{active.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
