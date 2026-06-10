import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FAQSection from "@/components/FAQSection";

export const metadata = { title: "FAQ — Yani Relics" };

export default function FAQPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
