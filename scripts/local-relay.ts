// Local testing only: forwards http://localhost:8080/callback (the callback xurl's X app already allows)
// to the Cheese Pay login handler, so no change is needed in the X developer portal.
//   node --experimental-strip-types scripts/local-relay.ts
import { createServer } from "node:http";

const TARGET = process.env.APP_URL ?? "http://localhost:3100";
createServer((req, res) => {
  const u = new URL(req.url ?? "/", "http://localhost:8080");
  if (u.pathname !== "/callback") { res.writeHead(404).end("not found"); return; }
  res.writeHead(302, { Location: `${TARGET}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth/x/callback${u.search}` }).end();
}).listen(8080, "127.0.0.1", () => console.log("relay on :8080 -> " + TARGET));
