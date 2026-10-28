import type { ReactNode } from "react";

export const metadata = { title: "Cheese Pay", description: "Tip anyone on X with a passkey wallet. $1 per tip, $10 a day, enforced onchain." };

const css = `
:root{--bg:#0E0D10;--fg:#FAFAFA;--mute:#A1A1AA;--line:#27272A;--red:#E21D20;--cheese:#F7C948}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#FAFAFA;--fg:#0E0D10;--mute:#52525B;--line:#E4E4E7}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 Geist,ui-sans-serif,system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:48px 16px}h1{font-size:2.2rem;line-height:1.15;margin:0 0 12px}h2{font-size:1.1rem;margin:32px 0 8px}
p,li{color:var(--mute)}a{color:var(--cheese)}.card{border:1px solid var(--line);border-radius:12px;padding:16px;margin:16px 0}
button,.btn{display:inline-block;background:var(--red);color:#fff;border:0;border-radius:10px;padding:12px 20px;font:600 1rem inherit;cursor:pointer;text-decoration:none}
button:disabled{opacity:.5;cursor:default}code{background:var(--line);padding:2px 6px;border-radius:6px;color:var(--fg)}
table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px solid var(--line);color:var(--mute);font-size:.9rem}`;

export default function Root({ children }: { children: ReactNode }) {
  return (<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style dangerouslySetInnerHTML={{ __html: css }} /></head><body><main>{children}</main></body></html>);
}
