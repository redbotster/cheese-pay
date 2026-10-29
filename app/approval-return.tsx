"use client";
import { useEffect, useState } from "react";

// After the user approves on 1Claw, 1Claw sends the popup back to Cheese Pay.
// If this page loads while an approval is in progress and it isn't the window that started it,
// tell the sign-in window and close ourselves.
export const APPROVING = "cp-approving", CHANNEL = "cp-approve";

export default function ApprovalReturn() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let started = 0;
    try { started = Number(localStorage.getItem(APPROVING) ?? 0); } catch { return; }
    let mine = false;
    try { mine = sessionStorage.getItem(APPROVING) === "1"; } catch {}
    if (mine || !started || Date.now() - started > 15 * 60_000) return;
    try { localStorage.removeItem(APPROVING); } catch {}
    setShown(true);
    try { const ch = new BroadcastChannel(CHANNEL); ch.postMessage("approved"); ch.close(); } catch {}
    setTimeout(() => window.close(), 400);
  }, []);
  if (!shown) return null;
  return (<div className="modal" role="dialog" aria-modal="true">
    <div className="card"><b>Approved</b><p>You're all set. Go back to the Cheese Pay window to finish signing in. You can close this one.</p></div>
  </div>);
}
