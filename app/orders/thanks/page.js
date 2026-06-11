import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ThanksClient from "./ThanksClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Thank you — Yani Relics",
  // Buyer-specific URL with order ID. Don't let search engines index it
  // (Codex review #3) — the page renders PII (shipping address, name)
  // when the right session matches.
  robots: { index: false, follow: false },
};

export default async function ThanksPage({ searchParams }) {
  const params = await searchParams;
  const orderId = typeof params?.o === "string" ? params.o : null;

  return (
    <>
      <Header />
      <main className="flex-1">
        <ThanksClient orderId={orderId} />
      </main>
      <Footer />
    </>
  );
}
