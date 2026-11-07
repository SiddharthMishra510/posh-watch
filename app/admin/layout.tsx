import type { Metadata } from "next";
import { headers } from "next/headers";
import "../globals.css";

export const metadata: Metadata = {
  title: "Back office",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: { icon: "/icon.svg" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await headers(); // per-request rendering for the CSP nonce
  return (
    <html lang="en">
      <body className="admin-body">
        <main className="wrap main">{children}</main>
      </body>
    </html>
  );
}
