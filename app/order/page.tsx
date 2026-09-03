import Link from "next/link";
import OrderBuilder from "../components/OrderBuilder";
import { getNextOrderCutoff } from "../order-config";

type OrderPageProps = {
  searchParams?: Promise<{ checkout?: string }>;
};

export default async function OrderPage({ searchParams }: OrderPageProps) {
  const params = await searchParams;
  const checkoutMessage = params?.checkout === "canceled"
    ? "Checkout was canceled. Your order is still here whenever you are ready."
    : undefined;

  return (
    <main className="orderPage">
      <Link className="orderPageBack" href="/">← ThreeByrd home</Link>
      <OrderBuilder initialCutoffIso={getNextOrderCutoff().toISOString()} checkoutMessage={checkoutMessage} />
    </main>
  );
}
