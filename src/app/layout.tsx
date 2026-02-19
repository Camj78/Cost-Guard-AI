import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://costguardai.com"
  ),
  title: "CostGuardAI — Know Before You Send",
  description:
    "Predict token usage, cost, truncation risk, and failure probability before submitting your AI prompt. Optimize prompts to prevent overbilling and model failure.",
  keywords: [
    "AI token counter",
    "prompt cost estimator",
    "LLM preflight",
    "context window checker",
    "prompt optimization",
    "ChatGPT cost calculator",
    "Claude token counter",
  ],
  openGraph: {
    title: "CostGuardAI — Know Before You Send",
    description:
      "Instantly estimate token count, cost, and failure risk for any AI prompt. Client-side — your prompts never leave your browser.",
    type: "website",
    images: [
      {
        url: "/logoV1.png",
        width: 512,
        height: 512,
        alt: "CostGuardAI",
      },
    ],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/logoV1.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
