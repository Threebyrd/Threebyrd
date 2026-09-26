import type { Product } from "../order-config";

type MacroSnapshotProps = {
  product: Product;
};

export default function MacroSnapshot({ product }: MacroSnapshotProps) {
  if (!product.calories || !product.proteinGrams || !product.carbs || !product.fat) {
    return null;
  }

  return (
    <div className="cardNutrition" aria-label={`${product.name}: ${product.calories} calories, ${product.proteinGrams} protein`}>
      <strong>{product.calories} cal</strong><span aria-hidden="true"> · </span><strong>{product.proteinGrams} protein</strong>
    </div>
  );
}
