import type { Product } from "../order-config";

type MacroSnapshotProps = {
  product: Product;
};

export default function MacroSnapshot({ product }: MacroSnapshotProps) {
  if (!product.calories || !product.proteinGrams || !product.carbs || !product.fat) {
    return null;
  }

  const macros = [
    { label: "Calories", value: product.calories },
    { label: "Protein", value: product.proteinGrams, className: "macroProtein" },
    { label: "Carbs", value: product.carbs },
    { label: "Fat", value: product.fat },
  ];

  return (
    <div className="cardNutrition" aria-label={`${product.name} Macro snapshot`}>
      <h4>Macro snapshot</h4>
      <div className="macroGrid">
        {macros.map((macro) => (
          <div className={macro.className} key={macro.label}>
            <span>{macro.label}</span>
            <strong>{macro.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
