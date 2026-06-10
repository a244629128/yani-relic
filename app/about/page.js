import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AboutSection from "@/components/AboutSection";

export const metadata = { title: "About — Yani Relics" };

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <AboutSection />
      </main>
      <Footer />
    </>
  );
}
