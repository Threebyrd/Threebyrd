import Link from "next/link";
import OrderBuilder from "../components/OrderBuilder";
import { getNextOrderCutoff } from "../order-config";

export const dynamic = "force-static";

export default function OrderPage() {
  return (
    <main className="orderPage">
      <Link className="orderPageBack" href="/">← ThreeByrd home</Link>
      <OrderBuilder initialCutoffIso={getNextOrderCutoff().toISOString()} />
    </main>
  );
}
