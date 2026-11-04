import { WEEKLY_MINIMUM_PROMOTION, PROMOTIONAL_MINIMUM_COPY } from "../order-config";

export default function OrderMinimum({ original = "3 meal minimum" }: { original?: string }) {
  return WEEKLY_MINIMUM_PROMOTION ? <span className="minimumPromotion"><s>{original}</s><span>{PROMOTIONAL_MINIMUM_COPY}</span></span> : <>{original}</>;
}
