"use client";

export default function SignOutButton() {
  const onClick = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };
  return (
    <button
      onClick={onClick}
      className="text-[11px] uppercase tracking-[0.18em] text-cream-dim hover:text-labradorite-light"
    >
      Sign out
    </button>
  );
}
