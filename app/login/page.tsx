import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import EmailLogin from "./email-login";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const sp = await searchParams;
  if ((await getSession()) && !sp.expired) redirect("/setup");
  return (<>
    <h1>Sign in</h1>
    <EmailLogin expired={!!sp.expired} />
    <p>New here? The same code creates your account. You'll set up a passkey right after.</p>
  </>);
}
