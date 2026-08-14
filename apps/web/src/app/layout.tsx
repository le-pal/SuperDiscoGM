import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperDiscoGM",
  description: "Maître du Jeu Virtuel",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
