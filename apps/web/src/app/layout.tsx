import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Gestão Comercial e Contabilidade",
  description: "Sistema de gestão comercial e contabilidade",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}