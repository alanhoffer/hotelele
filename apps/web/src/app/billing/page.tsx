"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Printer, ReceiptText } from "lucide-react";
import { invoiceStatusLabels, invoiceTypeLabels, permissions } from "@hotel-pms/shared";
import type { InvoiceStatus, InvoiceType } from "@hotel-pms/shared";
import { Protected } from "../../components/protected";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

type Invoice = {
  id: string;
  type: InvoiceType;
  status: InvoiceStatus;
  pointOfSale?: string | null;
  number?: string | null;
  totalAmount: string | number;
  createdAt: string;
  issuedAt?: string | null;
  folio: {
    reservation: {
      code: string;
      guest: { firstName: string; lastName: string };
      assignedRoom?: { number: string } | null;
    };
  };
};

type UnpaidFolio = {
  id: string;
  status: string;
  currency: string;
  openedAt: string;
  closedAt?: string | null;
  reservation: {
    code: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    guest: { firstName: string; lastName: string; phone?: string | null };
    assignedRoom?: { number: string } | null;
  };
  room: {
    number: string;
    floor?: string | null;
  };
  totals: {
    charges: number;
    payments: number;
    balance: number;
  };
};

export default function BillingPage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <BillingContent
            canCreate={session.permissions.includes(permissions.invoiceCreate)}
            canViewFolios={session.permissions.includes(permissions.folioView)}
          />
        </Shell>
      )}
    </Protected>
  );
}

function BillingContent({ canCreate, canViewFolios }: { canCreate: boolean; canViewFolios: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [unpaidFolios, setUnpaidFolios] = useState<UnpaidFolio[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [invoiceRows, unpaidRows] = await Promise.all([
      apiFetch<Invoice[]>("/invoices"),
      canViewFolios ? apiFetch<UnpaidFolio[]>("/folios/unpaid") : Promise.resolve([]),
    ]);
    setInvoices(invoiceRows);
    setUnpaidFolios(unpaidRows);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function markPendingAfip(invoice: Invoice) {
    setError(null);
    try {
      await apiFetch(`/invoices/${invoice.id}/pending-afip`, { method: "POST", body: "{}" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo pasar a AFIP.");
    }
  }

  async function cancelInvoice(invoice: Invoice) {
    setError(null);
    try {
      await apiFetch(`/invoices/${invoice.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Anulada desde facturacion" }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo anular.");
    }
  }

  function printUnpaidAccounts() {
    window.print();
  }

  const unpaidTotals = totalsByCurrency(unpaidFolios);
  const overdueCount = unpaidFolios.filter((folio) => unpaidTone(folio) === "overdue").length;
  const todayCount = unpaidFolios.filter((folio) => unpaidTone(folio) === "today").length;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Facturacion</h1>
          <p>Comprobantes preparados desde folios. AFIP real se integra antes del go-live.</p>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="panel unpaid-accounts-panel print-section" aria-label="Cuentas no pagadas">
        <div className="unpaid-accounts-header">
          <div>
            <span className="detail-kicker">Cuentas no pagadas</span>
            <h2>Saldo pendiente por cobrar</h2>
            <p>
              Folios con cargos mayores a pagos. Las cuentas vencidas y salidas de hoy se muestran con color
              diferente para recepcion y caja.
            </p>
          </div>
          <div className="unpaid-total-card">
            <span>Total pendiente</span>
            <strong>{formatCurrencyTotals(unpaidTotals)}</strong>
            <small>
              {unpaidFolios.length} cuenta{unpaidFolios.length === 1 ? "" : "s"} - {overdueCount} vencida
              {overdueCount === 1 ? "" : "s"} - {todayCount} sale{todayCount === 1 ? "" : "n"} hoy
            </small>
          </div>
        </div>

        <div className="unpaid-toolbar no-print">
          <div className="unpaid-legend">
            <span><i className="overdue" /> Vencida</span>
            <span><i className="today" /> Sale hoy</span>
            <span><i className="active" /> En estadia</span>
          </div>
          <button className="primary-button" disabled={!unpaidFolios.length} onClick={printUnpaidAccounts} type="button">
            <Printer size={15} />
            Imprimir cuentas
          </button>
        </div>

        {unpaidFolios.length ? (
          <div className="unpaid-table" role="table" aria-label="Listado imprimible de cuentas no pagadas">
            <div className="unpaid-table-head" role="row">
              <span>Habitacion</span>
              <span>Huesped</span>
              <span>Reserva</span>
              <span>Salida</span>
              <span>Cargos</span>
              <span>Pagos</span>
              <span>Saldo</span>
            </div>
            {unpaidFolios.map((folio) => {
              const tone = unpaidTone(folio);
              return (
                <article className={`unpaid-row ${tone}`} key={folio.id} role="row">
                  <span>
                    <strong>Hab. {folio.room.number}</strong>
                    <small>Piso {folio.room.floor ?? "-"}</small>
                  </span>
                  <span>
                    <strong>
                      {folio.reservation.guest.lastName}, {folio.reservation.guest.firstName}
                    </strong>
                    <small>{folio.reservation.guest.phone || "Sin telefono"}</small>
                  </span>
                  <span>
                    <strong>{folio.reservation.code}</strong>
                    <small>{folio.status === "open" ? "Cuenta abierta" : "Cuenta cerrada"}</small>
                  </span>
                  <span>
                    <strong>{formatDateOnly(folio.reservation.checkOutDate)}</strong>
                    <small>{unpaidLabel(folio)}</small>
                  </span>
                  <span>{formatMoney(folio.totals.charges, folio.currency)}</span>
                  <span>{formatMoney(folio.totals.payments, folio.currency)}</span>
                  <span className="unpaid-balance">
                    <AlertTriangle size={14} />
                    {formatMoney(folio.totals.balance, folio.currency)}
                  </span>
                </article>
              );
            })}
            <div className="unpaid-print-total">
              <span>Total cuentas no pagadas</span>
              <strong>{formatCurrencyTotals(unpaidTotals)}</strong>
            </div>
          </div>
        ) : (
          <div className="empty-state unpaid-empty">
            <ReceiptText size={20} />
            <span>No hay cuentas pendientes de pago.</span>
          </div>
        )}
      </section>

      <section className="reservations-list">
        {invoices.length ? (
          invoices.map((invoice) => (
            <article className="panel reservation-card" key={invoice.id}>
              <div className="room-top">
                <div>
                  <h2>{invoiceTypeLabels[invoice.type]}</h2>
                  <p>
                    {invoice.folio.reservation.code} - {invoice.folio.reservation.guest.lastName},{" "}
                    {invoice.folio.reservation.guest.firstName}
                  </p>
                </div>
                <span className={`badge ${invoice.status === "rejected" || invoice.status === "cancelled" ? "bad" : invoice.status === "pending_afip" ? "warn" : ""}`}>
                  {invoiceStatusLabels[invoice.status]}
                </span>
              </div>
              <div className="reservation-meta">
                <span>Hab. {invoice.folio.reservation.assignedRoom?.number ?? "-"}</span>
                <span>Total {formatMoney(Number(invoice.totalAmount))}</span>
                <span>Creado {formatDate(invoice.createdAt)}</span>
                <span>{invoice.pointOfSale ? `PV ${invoice.pointOfSale}` : "Sin punto de venta"}</span>
              </div>
              <div className="actions">
                {invoice.status === "draft" && invoice.type !== "internal_receipt" ? (
                  <button disabled={!canCreate} onClick={() => markPendingAfip(invoice)}>Pasar a AFIP</button>
                ) : null}
                {["draft", "pending_afip", "rejected"].includes(invoice.status) ? (
                  <button disabled={!canCreate} onClick={() => cancelInvoice(invoice)}>Anular</button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="panel empty-state">Todavia no hay comprobantes. Se crean desde la cuenta de una habitacion.</div>
        )}
      </section>
    </>
  );
}

function formatMoney(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function unpaidTone(folio: UnpaidFolio) {
  const checkout = startOfDay(new Date(folio.reservation.checkOutDate));
  const today = startOfDay(new Date());
  if (checkout < today) return "overdue";
  if (checkout.getTime() === today.getTime()) return "today";
  return "active";
}

function unpaidLabel(folio: UnpaidFolio) {
  const tone = unpaidTone(folio);
  if (tone === "overdue") return "Vencida";
  if (tone === "today") return "Sale hoy";
  return "En estadia/futura";
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function totalsByCurrency(folios: UnpaidFolio[]) {
  const totals = new Map<string, number>();
  for (const folio of folios) {
    totals.set(folio.currency, (totals.get(folio.currency) ?? 0) + folio.totals.balance);
  }
  return Array.from(totals.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((first, second) => first.currency.localeCompare(second.currency));
}

function formatCurrencyTotals(totals: { currency: string; amount: number }[]) {
  if (!totals.length) return formatMoney(0);
  return totals.map((total) => formatMoney(total.amount, total.currency)).join(" / ");
}
