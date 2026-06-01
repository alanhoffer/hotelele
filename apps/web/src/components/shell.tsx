"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BedDouble,
  CalendarDays,
  Hotel,
  Layers,
  LogOut,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { clearToken } from "../lib/api";

const navSections: {
  title: string;
  items: { href: string; label: string; icon: LucideIcon }[];
}[] = [
  {
    title: "Operacion",
    items: [
      { href: "/room-board", label: "Tablero", icon: BedDouble },
      { href: "/calendar", label: "Calendario", icon: CalendarDays },
      { href: "/reservations", label: "Buscar reservas", icon: Search },
      { href: "/availability", label: "Disponibilidad", icon: Layers },
    ],
  },
  {
    title: "Cobros",
    items: [
      { href: "/cash", label: "Caja", icon: Wallet },
      { href: "/billing", label: "Facturacion", icon: ReceiptText },
    ],
  },
  {
    title: "Servicios",
    items: [
      { href: "/housekeeping/mobile", label: "Mucamas movil", icon: Sparkles },
      { href: "/housekeeping", label: "Housekeeping", icon: Sparkles },
      { href: "/maintenance", label: "Mantenimiento", icon: Wrench },
    ],
  },
  {
    title: "Gestion",
    items: [
      { href: "/dashboard", label: "Resumen", icon: BarChart3 },
      { href: "/rooms", label: "Inventario", icon: Hotel },
      { href: "/users", label: "Usuarios", icon: Users },
      { href: "/audit", label: "Auditoria", icon: ShieldCheck },
    ],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeHref = navSections
    .flatMap((section) => section.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">H</span>
          <div>
            <strong>Hotel PMS</strong>
            <small>Nuevo sistema</small>
          </div>
        </div>
        <nav>
          {navSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <span>{section.title}</span>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={activeHref === item.href ? "active" : ""}>
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <button
          className="ghost-button"
          onClick={() => {
            clearToken();
            router.push("/login");
          }}
        >
          <LogOut size={16} />
          Salir
        </button>
        <div className="sidebar-profile">
          <span>N</span>
          <div>
            <strong>Nuevo PMS</strong>
            <small>Operacion hotelera</small>
          </div>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
