import type { Metadata } from "next";
import "./globals.css"
import { Toaster } from "@/components/ui/sonner";
import { AuthGate } from "@/components/auth/auth-gate";
import { UnhandledRejectionGuard } from "@/components/auth/unhandled-rejection-guard";

export const metadata: Metadata = {
  title: "VivaCRM",
  description: "CRM + Site para corretores e pequenas imobiliarias.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        <UnhandledRejectionGuard />
        <AuthGate>{children}</AuthGate>
        <Toaster />
      </body>
    </html>
  );
}
