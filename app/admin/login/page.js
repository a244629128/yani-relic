"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Wrong password");
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-5">
      <form
        onSubmit={onSubmit}
        className={`w-full max-w-sm card-relic p-7 sm:p-10 ${shake ? "animate-shake" : ""}`}
      >
        <h1
          className="font-chancery text-cream text-center"
          style={{ fontSize: 48, letterSpacing: "0.02em", lineHeight: 1 }}
        >
          Yani Relics
        </h1>
        <p className="text-center text-brass-light text-xs uppercase tracking-[0.22em] mt-2 mb-7">
          Vault
        </p>
        <label className="block text-cream-dim text-xs uppercase tracking-[0.18em] mb-2">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          className="w-full bg-forest/50 border border-parchment/35 rounded-[10px] px-4 py-3 text-cream focus:outline-none focus:border-labradorite-light"
        />
        {error && <p className="text-rose-300/80 text-sm mt-3 text-center">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn-relic w-full mt-6 disabled:opacity-50"
        >
          {submitting ? "Opening..." : "Enter the Vault"}
        </button>
      </form>
    </main>
  );
}
