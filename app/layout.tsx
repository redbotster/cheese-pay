import type { ReactNode } from "react";
import { Fredoka, Inter } from "next/font/google";
import { Wedge } from "./wedge";
import Logout from "./logout";
import { getSession } from "@/lib/session";

const display = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata = { title: "Cheese Pay", description: "Tip anyone on X in USDC. Passkey wallet, hard limits you control." };

const css = `
:root{--bg:#FFF7DB;--card:#FFFFFF;--fg:#2B1D06;--mute:#6B5A33;--line:#F1DFA0;--cheese:#FFC72C;--cheese-deep:#E8A200;--cheese-soft:#FFE9A3;--hole:rgba(232,162,0,.13);--red:#C62828;--ok:#2E7D32}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#1A1307;--card:#251B0A;--fg:#FFF3CC;--mute:#CDB87A;--line:#3B2D10;--cheese-soft:#3B2D10;--hole:rgba(255,199,44,.07);--red:#FF8A80;--ok:#81C784}}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;color:var(--fg);font:16px/1.6 var(--font-body),system-ui,sans-serif;min-height:100vh;
  background:
   radial-gradient(circle at 12% 14%,var(--hole) 0 38px,transparent 39px),
   radial-gradient(circle at 88% 8%,var(--hole) 0 62px,transparent 63px),
   radial-gradient(circle at 94% 62%,var(--hole) 0 30px,transparent 31px),
   radial-gradient(circle at 6% 78%,var(--hole) 0 54px,transparent 55px),
   radial-gradient(circle at 70% 96%,var(--hole) 0 44px,transparent 45px),var(--bg);background-attachment:fixed}
main{max-width:680px;margin:0 auto;padding:28px 16px 56px}
nav.top{display:flex;align-items:center;gap:10px;margin-bottom:28px;font-family:var(--font-display);font-weight:700;font-size:1.35rem}
nav.top a{color:inherit;text-decoration:none;display:flex;align-items:center;gap:10px}
nav.top svg{width:34px;height:auto}
h1{font-family:var(--font-display);font-weight:700;font-size:clamp(2rem,6vw,3rem);line-height:1.08;margin:0 0 12px;letter-spacing:-.01em}
h2{font-family:var(--font-display);font-weight:600;font-size:1.25rem;margin:32px 0 10px}
p,li{color:var(--mute)}
a{color:var(--cheese-deep);font-weight:600}
.hero{display:flex;gap:24px;align-items:center;margin:8px 0 28px;flex-wrap:wrap}
.hero>div{flex:1 1 300px;min-width:0}
.hero .wedge{width:150px;flex:none;filter:drop-shadow(0 10px 0 var(--hole))}
.hero p{font-size:1.1rem;margin:0 0 18px}
.card{background:var(--card);border:2px solid var(--line);border-radius:20px;padding:20px;margin:16px 0;box-shadow:0 4px 0 var(--line)}
.card b{color:var(--fg)}
.steps{counter-reset:s;list-style:none;padding:0;margin:0;display:grid;gap:12px}
.steps li{counter-increment:s;display:flex;gap:14px;align-items:flex-start;color:var(--fg)}
.steps li::before{content:counter(s);flex:none;width:32px;height:32px;border-radius:50%;background:var(--cheese);color:#2B1D06;
  font:700 1rem var(--font-display);display:grid;place-items:center;box-shadow:0 2px 0 var(--cheese-deep)}
.steps li span{color:var(--mute)}
button,.btn{display:inline-block;background:var(--cheese);color:#2B1D06;border:0;border-radius:14px;padding:12px 22px;font:700 1rem var(--font-display);
  cursor:pointer;text-decoration:none;box-shadow:0 4px 0 var(--cheese-deep);transition:transform .08s,box-shadow .08s}
button:hover,.btn:hover{transform:translateY(-1px)}
button:active,.btn:active{transform:translateY(3px);box-shadow:0 1px 0 var(--cheese-deep)}
button:disabled{opacity:.5;cursor:default;transform:none;box-shadow:0 4px 0 var(--cheese-deep)}
button.ghost{background:transparent;color:var(--fg);border:2px solid var(--line);box-shadow:none}
input[type=text],input[type=email],input[type=number],input:not([type]){padding:11px 14px;border-radius:12px;border:2px solid var(--line);background:var(--card);color:var(--fg);font:inherit}
input:focus{outline:3px solid var(--cheese);border-color:var(--cheese-deep)}
code{background:var(--cheese-soft);padding:2px 8px;border-radius:8px;color:var(--fg);font-size:.9em}
table{width:100%;border-collapse:collapse}td{padding:10px 4px;border-bottom:1px dashed var(--line);color:var(--mute);font-size:.92rem}
.err{color:var(--red)}.okk{color:var(--ok)}
footer{margin-top:48px;font-size:.85rem;text-align:center}
@media (max-width:520px){.hero{justify-content:center;text-align:center}.hero .wedge{width:120px}}`;

export default async function Root({ children }: { children: ReactNode }) {
  const s = await getSession();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /><style dangerouslySetInnerHTML={{ __html: css }} /></head>
      <body>
        <main>
          <nav className="top"><a href="/"><Wedge />Cheese Pay</a>{s && <span style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: ".95rem" }}>@{s.handle} <Logout /></span>}</nav>
          {children}
          <footer><p><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></p></footer>
        </main>
      </body>
    </html>
  );
}
