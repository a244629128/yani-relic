import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SignOutButton from "./_components/SignOutButton";

export const metadata = { title: "Vault — Yani Relics" };

export default async function AdminAuthedLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-dvh flex flex-col bg-forest text-cream">
      <header
        className="sticky top-0 z-30 border-b border-parchment/15"
        style={{
          background: "rgba(13, 22, 17, 0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-chancery text-parchment text-2xl">
            Vault
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light"
            >
              View site →
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
