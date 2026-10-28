import { ImageResponse } from "next/og";
import { wedgeSvg } from "./brand-image";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Cheese Pay: tip anyone on X";

export default function OpenGraph() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 56, padding: "0 90px", background: "#FFF7DB", color: "#2B1D06", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: 999, background: "rgba(232,162,0,.12)" }} />
      <div style={{ display: "flex", position: "absolute", bottom: -70, left: 140, width: 200, height: 200, borderRadius: 999, background: "rgba(232,162,0,.12)" }} />
      {wedgeSvg(360)}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1 }}>Cheese Pay</div>
        <div style={{ fontSize: 42, marginTop: 22, color: "#6B5A33" }}>Tip anyone on X. Easy as cheese.</div>
        <div style={{ display: "flex", marginTop: 34, fontSize: 30, color: "#2B1D06", background: "#FFC72C", padding: "14px 26px", borderRadius: 20, alignSelf: "flex-start" }}>cheesepay.me</div>
      </div>
    </div>, size);
}
