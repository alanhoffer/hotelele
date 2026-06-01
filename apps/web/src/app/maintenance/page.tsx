"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  maintenancePriorities,
  maintenancePriorityLabels,
  maintenanceTicketStatusLabels,
  permissions,
} from "@hotel-pms/shared";
import type { MaintenancePriority } from "@hotel-pms/shared";
import { Protected } from "../../components/protected";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

type Room = {
  id: string;
  number: string;
  floor?: string | null;
  roomType: { code: string; name: string };
};

type MaintenanceTicket = {
  id: string;
  title: string;
  description?: string | null;
  priority: MaintenancePriority;
  status: keyof typeof maintenanceTicketStatusLabels;
  outOfService: boolean;
  room?: Room | null;
  assignedTo?: { name: string } | null;
};

type FormState = {
  roomId: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  outOfService: boolean;
};

export default function MaintenancePage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <MaintenanceContent canUpdate={session.permissions.includes(permissions.maintenanceUpdate)} />
        </Shell>
      )}
    </Protected>
  );
}

function MaintenanceContent({ canUpdate }: { canUpdate: boolean }) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState<FormState>({
    roomId: "",
    title: "",
    description: "",
    priority: "medium",
    outOfService: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const [ticketRows, roomRows] = await Promise.all([
      apiFetch<MaintenanceTicket[]>("/maintenance/tickets"),
      apiFetch<Room[]>("/rooms"),
    ]);
    setTickets(ticketRows);
    setRooms(roomRows);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/maintenance/tickets", {
        method: "POST",
        body: JSON.stringify({
          roomId: form.roomId || undefined,
          title: form.title,
          description: form.description || undefined,
          priority: form.priority,
          outOfService: form.outOfService,
        }),
      });
      setForm({ roomId: "", title: "", description: "", priority: "medium", outOfService: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el ticket.");
    } finally {
      setLoading(false);
    }
  }

  async function runTicket(id: string, action: "start" | "resolve" | "cancel") {
    setError(null);
    try {
      await apiFetch(`/maintenance/tickets/${id}/${action}`, {
        method: "POST",
        body: action === "cancel" ? JSON.stringify({ reason: "Anulado desde mantenimiento" }) : "{}",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el ticket.");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Mantenimiento</h1>
          <p>Tickets por habitacion, bloqueo operativo y resolucion auditada.</p>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="split-grid">
        <form className="panel form-panel" onSubmit={createTicket}>
          <h2>Nuevo ticket</h2>
          <div className="form-grid">
            <label>
              Habitacion
              <select value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}>
                <option value="">Area general</option>
                {rooms.map((room) => (
                  <option value={room.id} key={room.id}>
                    {room.number} - {room.roomType.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Titulo
              <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label>
              Prioridad
              <select
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value as MaintenancePriority })}
              >
                {maintenancePriorities.map((priority) => (
                  <option value={priority} key={priority}>
                    {maintenancePriorityLabels[priority]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Descripcion
              <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={form.outOfService}
                onChange={(event) => setForm({ ...form, outOfService: event.target.checked })}
              />
              Fuera de servicio
            </label>
          </div>
          <button className="primary-button" disabled={!canUpdate || loading}>
            Crear ticket
          </button>
        </form>

        <section className="task-board">
          {tickets.map((ticket) => (
            <article className="panel task-card" key={ticket.id}>
              <div className="room-top">
                <div>
                  <h2>{ticket.title}</h2>
                  <p>{ticket.room ? `Hab. ${ticket.room.number}` : "Area general"}</p>
                </div>
                <span className={`badge ${ticket.priority === "urgent" ? "bad" : ticket.priority === "high" ? "warn" : ""}`}>
                  {maintenancePriorityLabels[ticket.priority]}
                </span>
              </div>
              <p>{ticket.description || "Sin descripcion."}</p>
              <div className="reservation-meta">
                <span>Estado: {maintenanceTicketStatusLabels[ticket.status]}</span>
                <span>{ticket.outOfService ? "Fuera de servicio" : "Operativo controlado"}</span>
                <span>Asignado: {ticket.assignedTo?.name ?? "-"}</span>
              </div>
              <div className="actions">
                {ticket.status === "pending" ? (
                  <button disabled={!canUpdate} onClick={() => runTicket(ticket.id, "start")}>Iniciar</button>
                ) : null}
                {["pending", "in_progress"].includes(ticket.status) ? (
                  <button disabled={!canUpdate} onClick={() => runTicket(ticket.id, "resolve")}>Resolver</button>
                ) : null}
                {["pending", "in_progress"].includes(ticket.status) ? (
                  <button disabled={!canUpdate} onClick={() => runTicket(ticket.id, "cancel")}>Anular</button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </section>
    </>
  );
}
