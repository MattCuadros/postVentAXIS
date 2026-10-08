import type { Metadata } from "next";
import { MaintenanceBanner } from "@/components/session/maintenance-banner";
import { isSupabaseFallback } from "@/data/supabase-repository";
import { SessionProvider } from "@/data/session-context";
import { DataProvider } from "@/data/store-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostventAXIS",
  description: "Gestión de postventa y garantías para clientes de Axis.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const mockMode = isSupabaseFallback();

  return (
    <html lang="es-CL" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <DataProvider>
          <MaintenanceBanner />
          {mockMode && (
            <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900" data-testid="mock-data-banner">
              Modo demostración: se están mostrando datos simulados porque no se pudo conectar la base de datos.
            </div>
          )}
          <SessionProvider>{children}</SessionProvider>
        </DataProvider>
      </body>
    </html>
  );
}
