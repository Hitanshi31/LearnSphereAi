import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LearnSphere AI — Your learning, understood",
  description: "An AI Learning Companion that continuously models student understanding.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
