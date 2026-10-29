"use client";
import { useEffect } from "react";
import { APPROVING, CHANNEL } from "../approval-return";

export default function Notify({ ok }: { ok: boolean }) {
  useEffect(() => {
    try { localStorage.removeItem(APPROVING); } catch {}
    try { const ch = new BroadcastChannel(CHANNEL); ch.postMessage(ok ? "approved" : "denied"); ch.close(); } catch {}
    const t = setTimeout(() => window.close(), 600);
    return () => clearTimeout(t);
  }, [ok]);
  return null;
}
