import Notify from "./notify";

// 1Claw sends the approval popup here after "Connect account".
export default async function Approved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  console.log("1claw approval return, params:", Object.keys(q).join(",") || "(none)"); // names only, never values
  const failed = typeof q.error === "string";
  return (<div className="card">
    <b>{failed ? "Not approved" : "Approved"}</b>
    <p>{failed ? "1Claw didn't approve Cheese Pay. Close this window and try again." : "You're all set. Go back to the Cheese Pay window to finish signing in. You can close this one."}</p>
    <Notify ok={!failed} />
  </div>);
}
