import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dao",
  description: "Track and save travel activities to Notion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
