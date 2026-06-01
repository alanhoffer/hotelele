"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/shell";
import { Protected } from "../../components/protected";
import { apiFetch } from "../../lib/api";

type User = {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt?: string | null;
  role: { name: string; code: string };
};

export default function UsersPage() {
  return (
    <Protected>
      {() => (
        <Shell>
          <UsersContent />
        </Shell>
      )}
    </Protected>
  );
}

function UsersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<User[]>("/users").then(setUsers).catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Vista inicial de usuarios y roles. Edicion entra en el siguiente incremento.</p>
        </div>
      </header>
      {error ? <div className="error">{error}</div> : null}
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Ultimo acceso</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role.name}</td>
                <td>{user.status}</td>
                <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
