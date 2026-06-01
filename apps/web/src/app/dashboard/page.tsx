"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@hotel-pms/ui";
import { Shell } from "../../components/shell";
import { Protected } from "../../components/protected";
import { apiFetch } from "../../lib/api";

type Dashboard = {
  totalRooms: number;
  commercial: Record<string, number>;
  cleaning: Record<string, number>;
  maintenance: Record<string, number>;
  recentAudit: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    user?: { name: string } | null;
  }>;
};

export default function DashboardPage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <DashboardContent hotelName={session.hotel.name} userName={session.user.name} />
        </Shell>
      )}
    </Protected>
  );
}

function DashboardContent({ hotelName, userName }: { hotelName: string; userName: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Dashboard>("/dashboard").then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="empty-state">Cargando centro operativo...</div>;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Centro operativo</h1>
          <p>
            {hotelName} - Sesion de {userName}
          </p>
        </div>
      </header>

      <section className="grid stats-grid">
        <StatCard label="Habitaciones" value={data.totalRooms} />
        <StatCard label="Disponibles" value={data.commercial.available ?? 0} tone="good" />
        <StatCard label="Ocupadas" value={data.commercial.occupied ?? 0} />
        <StatCard label="Sucias" value={data.cleaning.dirty ?? 0} tone="warn" />
        <StatCard label="Mantenimiento" value={data.maintenance.pending ?? 0} tone="bad" />
      </section>

      <section className="panel">
        <h2>Actividad reciente</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Accion</th>
              <th>Entidad</th>
            </tr>
          </thead>
          <tbody>
            {data.recentAudit.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.user?.name ?? "Sistema"}</td>
                <td>{log.action}</td>
                <td>{log.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
