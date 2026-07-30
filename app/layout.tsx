import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host?.includes("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host || "localhost:3000"}`);
  const socialImageUrl = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: "周报工坊｜高效周报编辑器",
    description:
      "一站式维护风险点、管道需求、运营需求和公共待办，自定义表格列并一键生成美观周报。",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "周报工坊",
      description: "让每周汇报，清楚又省心",
      type: "website",
      images: [{ url: socialImageUrl, width: 1672, height: 941, alt: "周报工坊" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "周报工坊",
      description: "让每周汇报，清楚又省心",
      images: [socialImageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
