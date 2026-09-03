import Image from "next/image";
import type { CSSProperties } from "react";
import { withBasePath } from "../site-paths";

const options = [
  {
    name: "Honey Gold",
    note: "Warm, food-friendly, and brighter without feeling neon.",
    deep: "#9F681A",
    gold: "#DCA62F",
    soft: "#F2CF78",
    pale: "#FFF0BF",
    current: true,
  },
  {
    name: "Champagne Gold",
    note: "Lighter and a little more premium, with less orange.",
    deep: "#9A7524",
    gold: "#D9B64C",
    soft: "#F1D78A",
    pale: "#FFF2CD",
  },
  {
    name: "Varsity Gold",
    note: "The boldest option. Energetic, collegiate, and high contrast.",
    deep: "#A66200",
    gold: "#E7A81B",
    soft: "#F7CF5B",
    pale: "#FFF0AE",
  },
  {
    name: "Marigold",
    note: "Warmer and more playful, with a subtle orange lean.",
    deep: "#A95B0C",
    gold: "#E49A28",
    soft: "#F3C56B",
    pale: "#FFECC0",
  },
];

type PreviewStyle = CSSProperties & {
  "--preview-deep": string;
  "--preview-gold": string;
  "--preview-soft": string;
  "--preview-pale": string;
};

export default function GoldOptions() {
  return (
    <main className="goldOptionsPage">
      <header className="goldOptionsHeader">
        <a href={withBasePath("/")} aria-label="Back to ThreeByrd Meal Prep">
          <Image
            src="/assets/threebyrd-logo.png"
            alt="ThreeByrd Meal Prep official logo"
            width={3938}
            height={2591}
            priority
          />
        </a>
        <div>
          <p className="sectionLabel">Color Study</p>
          <h1>Choose the gold.</h1>
          <p>The full site is currently previewing Honey Gold.</p>
        </div>
      </header>

      <div className="goldOptionGrid">
        {options.map((option) => {
          const style: PreviewStyle = {
            "--preview-deep": option.deep,
            "--preview-gold": option.gold,
            "--preview-soft": option.soft,
            "--preview-pale": option.pale,
          };

          return (
            <section className="goldOption" key={option.name} style={style}>
              <div className="goldOptionTop">
                <div>
                  <span>{option.current ? "Current preview" : "Option"}</span>
                  <h2>{option.name}</h2>
                </div>
                <strong>70g</strong>
              </div>
              <p>{option.note}</p>
              <div className="goldSwatches" aria-label={`${option.name} color swatches`}>
                <span><i className="swatchDeep" />Deep</span>
                <span><i className="swatchGold" />Main</span>
                <span><i className="swatchSoft" />Soft</span>
                <span><i className="swatchPale" />Pale</span>
              </div>
              <div className="goldOptionSample">
                <button type="button">See the menu</button>
                <span>Protein-forward meal prep</span>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
