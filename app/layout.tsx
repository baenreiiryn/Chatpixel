import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OracleRPG",
  description: "Uma interface persistente para campanhas narradas por IA.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
