import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LearnSphere AI — Your learning, understood",
  description: "An AI Learning Companion that continuously models student understanding.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Mermaid.js for concept map rendering */}
        <script
          type="module"
          dangerouslySetInnerHTML={{
            __html: `
              import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
              mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
              window.mermaid = mermaid;
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
