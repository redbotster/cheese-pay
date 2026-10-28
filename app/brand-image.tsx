// Shared artwork for the Apple touch icon and the link preview image (rendered to PNG by next/og).
export const wedgeSvg = (size: number) => (
  <svg width={size} height={size * 0.71} viewBox="0 0 240 170">
    <polygon points="20,70 150,18 224,58 92,112" fill="#FFE27A" />
    <polygon points="20,70 92,112 92,152 20,112" fill="#FFC72C" />
    <polygon points="92,112 224,58 224,100 92,152" fill="#F2A900" />
    <ellipse cx="150" cy="62" rx="14" ry="7" fill="#E8A200" opacity=".55" />
    <ellipse cx="50" cy="104" rx="8" ry="10" fill="#C98A00" opacity=".6" />
    <ellipse cx="148" cy="122" rx="14" ry="12" fill="#C98A00" opacity=".55" />
    <ellipse cx="196" cy="88" rx="9" ry="8" fill="#B87800" opacity=".5" />
  </svg>
);
