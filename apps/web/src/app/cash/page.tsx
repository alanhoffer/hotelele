"use client";

import { FormEvent, useEffect, useState } from "react";
import { cashMovementKinds, paymentMethodLabels, paymentMethods, permissions } from "@hotel-pms/shared";
import type { CashMovementKind, PaymentMethod } from "@hotel-pms/shared";
import { Protected } from "../../components/protected";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

type CashSession = {
  id: string;
  status: string;
  openingAmount: number;
  countedCash?: number | null;
  openedAt: string;
  closedAt?: string | null;
  openedBy: { name: string };
  closedBy?: { name: string } | null;
  payments: { id: string; method: PaymentMethod; amount: number }[];
  movements: { id: string; kind: CashMovementKind; method: PaymentMethod; amount: number; description: string }[];
  totals: {
    payments: number;
    expenses: number;
    adjustments: number;
    expectedCash: number;
    difference: number | null;
  };
};

export default function CashPage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <CashContent canManage={session.permissions.includes(permissions.cashManage)} />
        </Shell>
      )}
    </Protected>
  );
}

function CashContent({ canManage }: { canManage: boolean }) {
  const [current, setCurrent] = useState<CashSession | null>(null);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [movement, setMovement] = useState({
    kind: "expense" as CashMovementKind,
    method: "cash" as PaymentMethod,
    amount: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [currentRow, rows] = await Promise.all([
      apiFetch<{ session: CashSession | null }>("/cash-sessions/current"),
      apiFetch<CashSession[]>("/cash-sessions"),
    ]);
    setCurrent(currentRow.session);
    setSessions(rows);
    setCountedCash(currentRow.session ? String(Math.round(currentRow.session.totals.expectedCash)) : "");
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function openSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/cash-sessions/open", {
        method: "POST",
        body: JSON.stringify({ openingAmount }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir caja.");
    }
  }

  async function addMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    setError(null);
    try {
      await apiFetch(`/cash-sessions/${current.id}/movements`, {
        method: "POST",
        body: JSON.stringify(movement),
      });
      setMovement({ kind: "expense", method: "cash", amount: "", description: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar movimiento.");
    }
  }

  async function closeSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    setError(null);
    try {
      await apiFetch(`/cash-sessions/${current.id}/close`, {
        method: "POST",
        body: JSON.stringify({ countedCash }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar caja.");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Caja</h1>
          <p>Apertura, movimientos, pagos del turno y cierre con diferencia.</p>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="split-grid">
        <div className="grid">
          <section className="panel form-panel">
            <h2>Caja actual</h2>
            {current ? (
              <>
                <div className="stats-grid cash-stats">
                  <div className="stat-card">
                    <span>Apertura</span>
                    <strong>{formatMoney(current.openingAmount)}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Pagos</span>
                    <strong>{formatMoney(current.totals.payments)}</strong>
                  </div>
                  <div className="stat-card stat-card-good">
                    <span>Esperado</span>
                    <strong>{formatMoney(current.totals.expectedCash)}</strong>
                  </div>
                </div>
                <form className="form-grid" onSubmit={addMovement}>
                  <label>
                    Movimiento
                    <select
                      value={movement.kind}
                      onChange={(event) => setMovement({ ...movement, kind: event.target.value as CashMovementKind })}
                    >
                      {cashMovementKinds.filter((kind) => kind !== "payment").map((kind) => (
                        <option value={kind} key={kind}>
                          {kind === "expense" ? "Egreso" : "Ajuste"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Medio
                    <select
                      value={movement.method}
                      onChange={(event) => setMovement({ ...movement, method: event.target.value as PaymentMethod })}
                    >
                      {paymentMethods.map((method) => (
                        <option value={method} key={method}>
                          {paymentMethodLabels[method]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Importe
                    <input
                      required
                      type="number"
                      value={movement.amount}
                      onChange={(event) => setMovement({ ...movement, amount: event.target.value })}
                    />
                  </label>
                  <label>
                    Descripcion
                    <input
                      required
                      value={movement.description}
                      onChange={(event) => setMovement({ ...movement, description: event.target.value })}
                    />
                  </label>
                  <button className="primary-button" disabled={!canManage}>Registrar movimiento</button>
                </form>
                <form className="form-grid" onSubmit={closeSession}>
                  <label>
                    Efectivo contado
                    <input
                      required
                      type="number"
                      value={countedCash}
                      onChange={(event) => setCountedCash(event.target.value)}
                    />
                  </label>
                  <button className="primary-button" disabled={!canManage}>Cerrar caja</button>
                </form>
              </>
            ) : (
              <form className="form-grid" onSubmit={openSession}>
                <label>
                  Monto inicial
                  <input
                    required
                    min="0"
                    type="number"
                    value={openingAmount}
                    onChange={(event) => setOpeningAmount(event.target.value)}
                  />
                </label>
                <button className="primary-button" disabled={!canManage}>Abrir caja</button>
              </form>
            )}
          </section>
        </div>

        <section className="task-board">
          {sessions.map((session) => (
            <article className="panel task-card" key={session.id}>
              <div className="room-top">
                <div>
                  <h2>{session.status === "open" ? "Caja abierta" : "Caja cerrada"}</h2>
                  <p>{session.openedBy.name} - {formatDate(session.openedAt)}</p>
                </div>
                <span className={`badge ${session.status === "closed" ? "" : "warn"}`}>
                  {session.status === "open" ? "Abierta" : "Cerrada"}
                </span>
              </div>
              <div className="reservation-meta">
                <span>Pagos {formatMoney(session.totals.payments)}</span>
                <span>Egresos {formatMoney(session.totals.expenses)}</span>
                <span>Esperado {formatMoney(session.totals.expectedCash)}</span>
                <span>Diferencia {session.totals.difference === null ? "-" : formatMoney(session.totals.difference)}</span>
              </div>
            </article>
          ))}
        </section>
      </section>
    </>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
