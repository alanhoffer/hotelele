"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cleaningStatuses,
  commercialStatuses,
  maintenanceStatuses,
  permissions,
  statusLabels,
} from "@hotel-pms/shared";
import { Shell } from "../../components/shell";
import { Protected } from "../../components/protected";
import { apiFetch } from "../../lib/api";

type Room = {
  id: string;
  number: string;
  floor?: string | null;
  block?: string | null;
  commercialStatus: string;
  cleaningStatus: string;
  maintenanceStatus: string;
  roomType: { name: string; code: string };
};

export default function RoomsPage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <RoomsContent canUpdate={session.permissions.includes(permissions.roomUpdateStatus)} />
        </Shell>
      )}
    </Protected>
  );
}

function RoomsContent({ canUpdate }: { canUpdate: boolean }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<Room[]>("/rooms");
    setRooms(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const visibleRooms = useMemo(() => {
    if (filter === "all") return rooms;
    return rooms.filter(
      (room) =>
        room.commercialStatus === filter ||
        room.cleaningStatus === filter ||
        room.maintenanceStatus === filter ||
        room.roomType.code === filter,
    );
  }, [filter, rooms]);

  async function updateStatus(room: Room, key: string, value: string) {
    setError(null);
    try {
      await apiFetch(`/rooms/${room.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value, reason: "Cambio desde tablero inicial" }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Habitaciones</h1>
          <p>Tablero operativo con estados separados de venta, limpieza y mantenimiento.</p>
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">Todas</option>
          <option value="STD">STD</option>
          <option value="SUP">SUP</option>
          <option value="STE">Suite</option>
          <option value="dirty">Sucias</option>
          <option value="pending">Mantenimiento pendiente</option>
          <option value="blocked">Bloqueadas</option>
        </select>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="rooms-grid">
        {visibleRooms.map((room) => (
          <article className="room-card" key={room.id}>
            <div className="room-top">
              <div>
                <div className="room-number">{room.number}</div>
                <div>
                  {room.roomType.name} - Piso {room.floor ?? "-"} - {room.block ?? "Sin bloque"}
                </div>
              </div>
              <StatusBadge value={room.commercialStatus} />
            </div>

            <StatusSelect
              label="Comercial"
              value={room.commercialStatus}
              values={commercialStatuses}
              disabled={!canUpdate}
              onChange={(value) => updateStatus(room, "commercialStatus", value)}
            />
            <StatusSelect
              label="Limpieza"
              value={room.cleaningStatus}
              values={cleaningStatuses}
              disabled={!canUpdate}
              onChange={(value) => updateStatus(room, "cleaningStatus", value)}
            />
            <StatusSelect
              label="Mantenimiento"
              value={room.maintenanceStatus}
              values={maintenanceStatuses}
              disabled={!canUpdate}
              onChange={(value) => updateStatus(room, "maintenanceStatus", value)}
            />
          </article>
        ))}
      </section>
    </>
  );
}

function StatusSelect({
  label,
  value,
  values,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  values: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="status-row">
      <label>{label}</label>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {values.map((status) => (
          <option value={status} key={status}>
            {statusLabels[status] ?? status}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const tone = value === "available" ? "" : value === "occupied" ? "warn" : "bad";
  return <span className={`badge ${tone}`}>{statusLabels[value] ?? value}</span>;
}
