import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AI Cost Disaster Gallery | CostGuardAI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #09090b 0%, #18181b 60%, #0d0d10 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "64px 72px",
          fontFamily: "Inter, -apple-system, system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Top label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "20px",
            gap: "10px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#71717a",
            }}
          >
            CostGuardAI
          </span>
          <span style={{ color: "#3f3f46", fontSize: "13px" }}>·</span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#3f3f46",
            }}
          >
            Preflight Safety for AI Products
          </span>
        </div>

        {/* Main heading */}
        <div
          style={{
            fontSize: "58px",
            fontWeight: 900,
            color: "#fafafa",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            marginBottom: "20px",
            maxWidth: "900px",
          }}
        >
          AI Cost Disaster Gallery
        </div>

        {/* Subheading */}
        <div
          style={{
            fontSize: "20px",
            color: "#71717a",
            lineHeight: 1.5,
            marginBottom: "40px",
            maxWidth: "680px",
          }}
        >
          5 real prompt failure patterns that cause runaway AI costs and
          production failures — with mitigations.
        </div>

        {/* Failure tags */}
        <div style={{ display: "flex", gap: "12px" }}>
          {[
            { label: "Token explosion", color: "#ef4444" },
            { label: "Prompt injection", color: "#ef4444" },
            { label: "Runaway tool calls", color: "#ef4444" },
          ].map(({ label, color }) => (
            <div
              key={label}
              style={{
                border: `1px solid rgba(239,68,68,0.25)`,
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                color,
                background: "rgba(239,68,68,0.06)",
                display: "flex",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Bottom CTA label */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            right: "72px",
            fontSize: "14px",
            color: "#3f3f46",
            fontWeight: 500,
          }}
        >
          costguardai.com/examples
        </div>
      </div>
    ),
    { ...size }
  );
}
