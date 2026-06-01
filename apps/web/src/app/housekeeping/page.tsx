"use client";

import { FormEvent, useEffect, useState } from "react";
import { housekeepingTaskStatusLabels, permissions, statusLabels } from "@hotel-pms/shared";
import { Protected } from "../../components/protected";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

type Room = {
  id: string;
  number: string;
  floor?: string | null;
  cleaningStatus: string;
  roomType: { code: string; name: string };
};

type HousekeepingTask = {
  id: string;
  status: keyof typeof housekeepingTaskStatusLabels;
  source: string;
  notes?: string | null;
  room: Room;
  assignedTo?: { name: string } | null;
};

export default function HousekeepingPage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <HousekeepingContent canUpdate={session.permissions.includes(permissions.housekeepingUpdate)} />
        </Shell>
      )}
    </Protected>
  );
}

function HousekeepingContent({ canUpdate }: { canUpdate: boolean }) {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const [taskRows, roomRows] = await Promise.all([
      apiFetch<HousekeepingTask[]>("/housekeeping/tasks"),
      apiFetch<Room[]>("/rooms"),
    ]);
    setTasks(taskRows);
    setRooms(roomRows);
    setRoomId((current) => current || roomRows.find((room) => room.cleaningStatus !== "clean")?.id || roomRows[0]?.id || "");
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/housekeeping/tasks", {
        method: "POST",
        body: JSON.stringify({ roomId, notes: notes || undefined, source: "manual" }),
      });
      setNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la tarea.");
    } finally {
      setLoading(false);
    }
  }

  async function runTask(id: string, action: "start" | "finish" | "approve" | "cancel") {
    setError(null);
    try {
      await apiFetch(`/housekeeping/tasks/${id}/${action}`, {
        method: "POST",
        body: action === "cancel" ? JSON.stringify({ reason: "Anulada desde housekeeping" }) : "{}",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la tarea.");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Housekeeping</h1>
          <p>Limpieza, inspeccion y disponibilidad real despues del check-out.</p>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="split-grid">
        <form className="panel form-panel" onSubmit={createTask}>
          <h2>Nueva tarea</h2>
          <div className="form-grid">
            <label>
              Habitacion
              <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
                {rooms.map((room) => (
                  <option value={room.id} key={room.id}>
                    {room.number} - {statusLabels[room.cleaningStatus] ?? room.cleaningStatus}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notas
              <input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>
          <button className="primary-button" disabled={!canUpdate || loading || !roomId}>
            Crear tarea
          </button>
        </form>

        <section className="task-board">
          {tasks.map((task) => (
            <article className="panel task-card" key={task.id}>
              <div className="room-top">
                <div>
                  <h2>Hab. {task.room.number}</h2>
                  <p>{task.room.roomType.code} - Piso {task.room.floor ?? "-"}</p>
                </div>
                <span className="badge">{housekeepingTaskStatusLabels[task.status]}</span>
              </div>
              <p>{task.notes || "Sin notas."}</p>
              <div className="reservation-meta">
                <span>Limpieza: {statusLabels[task.room.cleaningStatus] ?? task.room.cleaningStatus}</span>
                <span>Asignada: {task.assignedTo?.name ?? "-"}</span>
                <span>Origen: {task.source}</span>
              </div>
              <div className="actions">
                {task.status === "pending" ? (
                  <button disabled={!canUpdate} onClick={() => runTask(task.id, "start")}>Iniciar</button>
                ) : null}
                {task.status === "in_progress" ? (
                  <button disabled={!canUpdate} onClick={() => runTask(task.id, "finish")}>Terminar</button>
                ) : null}
                {task.status === "inspection" ? (
                  <button disabled={!canUpdate} onClick={() => runTask(task.id, "approve")}>Aprobar limpia</button>
                ) : null}
                {["pending", "in_progress", "inspection"].includes(task.status) ? (
                  <button disabled={!canUpdate} onClick={() => runTask(task.id, "cancel")}>Anular</button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </section>
    </>
  );
}
