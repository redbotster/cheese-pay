import Notify from "./notify";

const COPY: Record<string, [string, string]> = {
  signedin: ["Signed in", "You're in. Going back to Cheese Pay…"],
  denied: ["Not approved", "1Claw didn't approve Cheese Pay. Close this window and try again."],
  expired: ["That took too long", "Close this window and try signing in again."],
  busy: ["Too many tries", "Wait a few minutes, then try again."],
  failed: ["Something went wrong", "1Claw didn't finish the sign-in. Close this window and try again."],
};

// 1Claw sends the sign-in popup here (directly, or through /api/auth/oneclaw/callback).
export default async function Approved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  console.log("1claw return, params:", Object.keys(q).join(",") || "(none)"); // names only, never values
  const result = typeof q.result === "string" && q.result in COPY ? q.result : typeof q.error === "string" ? "denied" : "approved";
  const [title, body] = COPY[result] ?? ["Approved", "You're all set. Go back to the Cheese Pay window to finish signing in. You can close this one."];
  return (<div className="card">
    <b>{title}</b>
    <p>{body}</p>
    <Notify result={result} />
  </div>);
}
