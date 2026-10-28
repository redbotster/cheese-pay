import { ImageResponse } from "next/og";
import { wedgeSvg } from "../../brand-image";

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = (await params).size === "192" ? 192 : 512;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF3C4" }}>{wedgeSvg(Math.round(n * 0.7))}</div>,
    { width: n, height: n, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
