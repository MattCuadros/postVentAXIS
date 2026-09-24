import type { Metadata } from "next";
import { SessionProvider } from "@/data/session-context";
import { DataProvider } from "@/data/store-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostventAXIS",
  description: "Gestión de postventa y garantías para clientes de Axis.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <DataProvider>
          <SessionProvider>{children}</SessionProvider>
        </DataProvider>
      </body>
    </html>
  );
}
