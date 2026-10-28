"use client";
import { useState } from "react";
import { BASE } from "@/lib/base";

/** Logs out this browser, or every device when `everywhere` is set. */
export default function Logout({ everywhere = false, label }: { everywhere?: boolean; label?: string }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    if (everywhere && !confirm("Log out of Cheese Pay on every device?")) return;
    setBusy(true);
    try { await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ everywhere }) }); }
    finally { location.href = BASE || "/"; }
  }
  return <button className="ghost" onClick={go} disabled={busy}>{busy ? "Logging out…" : label ?? "Log out"}</button>;
}
