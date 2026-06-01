"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/shell";
import { Protected } from "../../components/protected";
import { apiFetch } from "../../lib/api";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  reason?: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
};

export default function AuditPage() {
  return (
    <Protected>
      {() => (
        <Shell>
          <AuditContent />
        </Shell>
      )}
    </Protected>
  );
}

function AuditContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuditLog[]>("/audit").then(setLogs).catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Auditoria</h1>
          <p>Acciones sensibles y actividad reciente del sistema.</p>
        </div>
      </header>
      {error ? <div className="error">{error}</div> : null}
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Accion</th>
              <th>Entidad</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.user?.name ?? "Sistema"}</td>
                <td>{log.action}</td>
                <td>
                  {log.entity}
                  {log.entityId ? <small> · {log.entityId.slice(0, 8)}</small> : null}
                </td>
                <td>{log.reason ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
