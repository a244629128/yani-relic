import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CheckoutContent from "@/components/CheckoutContent";

export const metadata = {
  title: "Checkout — Yani Relics",
  robots: { index: false, follow: false },
};

// Server-rendered shell. All state lives in localStorage (client-only),
// so the shell is intentionally empty — CheckoutContent hydrates from
// localStorage on mount and calls a server action to fetch the actual
// product data.
export default function CheckoutPage() {
  const paypalClientId =
    process.env.PAYPAL_DISABLED === "true"
      ? null
      : process.env.PAYPAL_CLIENT_ID || null;

  return (
    <>
      <Header />
      <main className="flex-1 pb-24 md:pb-16">
        <CheckoutContent paypalClientId={paypalClientId} />
      </main>
      <Footer />
    </>
  );
}
