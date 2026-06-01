"use client";

import { FormEvent, useEffect, useState } from "react";
import { Protected } from "../../components/protected";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

type Availability = {
  from: string;
  to: string;
  totalRooms: number;
  reserved: number;
  available: number;
  roomTypes: Array<{
    roomType: {
      id: string;
      code: string;
      name: string;
      baseCapacity: number;
      maxCapacity: number;
    };
    totalRooms: number;
    reserved: number;
    available: number;
    availableRooms: Array<{
      id: string;
      number: string;
      floor?: string | null;
      block?: string | null;
    }>;
  }>;
};

export default function AvailabilityPage() {
  return (
    <Protected>
      {() => (
        <Shell>
          <AvailabilityContent />
        </Shell>
      )}
    </Protected>
  );
}

function AvailabilityContent() {
  const [from, setFrom] = useState(() => toDateInput(new Date()));
  const [to, setTo] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toDateInput(tomorrow);
  });
  const [data, setData] = useState<Availability | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(nextFrom = from, nextTo = to) {
    setError(null);
    try {
      const result = await apiFetch<Availability>(`/availability?from=${nextFrom}&to=${nextTo}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar disponibilidad.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Disponibilidad</h1>
          <p>Consulta por rango con reservas confirmadas, asignadas y alojadas.</p>
        </div>
        <form className="toolbar" onSubmit={submit}>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <button className="primary-button">Consultar</button>
        </form>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {!data ? <div className="empty-state">Cargando disponibilidad...</div> : null}

      {data ? (
        <>
          <section className="grid stats-grid">
            <div className="stat-card">
              <span>Habitaciones vendibles</span>
              <strong>{data.totalRooms}</strong>
            </div>
            <div className="stat-card stat-card-warn">
              <span>Reservadas</span>
              <strong>{data.reserved}</strong>
            </div>
            <div className="stat-card stat-card-good">
              <span>Disponibles</span>
              <strong>{data.available}</strong>
            </div>
          </section>

          <section className="availability-grid">
            {data.roomTypes.map((row) => (
              <article className="panel availability-card" key={row.roomType.id}>
                <div className="room-top">
                  <div>
                    <h2>
                      {row.roomType.code} - {row.roomType.name}
                    </h2>
                    <p>
                      Base {row.roomType.baseCapacity} pax / Max {row.roomType.maxCapacity} pax
                    </p>
                  </div>
                  <span className={`badge ${row.available === 0 ? "bad" : ""}`}>
                    {row.available} libres
                  </span>
                </div>
                <div className="availability-bars">
                  <div>
                    <span>Total</span>
                    <strong>{row.totalRooms}</strong>
                  </div>
                  <div>
                    <span>Tomadas</span>
                    <strong>{row.reserved}</strong>
                  </div>
                  <div>
                    <span>Libres</span>
                    <strong>{row.available}</strong>
                  </div>
                </div>
                <div className="room-chip-list">
                  {row.availableRooms.length ? (
                    row.availableRooms.map((room) => <span key={room.id}>Hab. {room.number}</span>)
                  ) : (
                    <span>Sin habitaciones disponibles</span>
                  )}
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </>
  );
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
