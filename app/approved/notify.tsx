"use client";
import { useEffect } from "react";
import { APPROVING, CHANNEL } from "@/lib/approval";

export default function Notify({ result }: { result: string }) {
  useEffect(() => {
    try { localStorage.removeItem(APPROVING); } catch {}
    try { const ch = new BroadcastChannel(CHANNEL); ch.postMessage(result); ch.close(); } catch {}
    // Opened as a popup: close it. Opened in the main tab (popup blocked): carry on to setup.
    const t = setTimeout(() => { window.close(); if (result === "signedin") location.href = "/setup"; }, 600);
    return () => clearTimeout(t);
  }, [result]);
  return null;
}
