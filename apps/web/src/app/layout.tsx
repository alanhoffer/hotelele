import type { Metadata } from "next";
import { SupportWidget } from "../components/support-widget";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hotel PMS",
  description: "Sistema operativo hotelero para recepcion, caja, habitaciones y housekeeping.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <SupportWidget />
      </body>
    </html>
  );
}
