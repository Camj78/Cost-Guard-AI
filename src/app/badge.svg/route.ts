import { NextResponse } from "next/server";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="176" height="20" role="img" aria-label="CostGuardAI: Protected">
  <title>CostGuardAI: Protected</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="176" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="103" height="20" fill="#1f2937"/>
    <rect x="103" width="73" height="20" fill="#16a34a"/>
    <rect width="176" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110">
    <text aria-hidden="true" x="525" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="930" lengthAdjust="spacing">CostGuardAI</text>
    <text x="525" y="140" transform="scale(.1)" textLength="930" lengthAdjust="spacing">CostGuardAI</text>
    <text aria-hidden="true" x="1385" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="630" lengthAdjust="spacing">Protected</text>
    <text x="1385" y="140" transform="scale(.1)" textLength="630" lengthAdjust="spacing">Protected</text>
  </g>
</svg>`;

export function GET() {
  return new NextResponse(SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
