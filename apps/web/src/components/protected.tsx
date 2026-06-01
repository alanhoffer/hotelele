"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, getToken } from "../lib/api";

type Session = {
  user: { name: string; email: string };
  hotel: { name: string };
  permissions: string[];
};

export function Protected({
  children,
}: {
  children: (session: Session) => React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    apiFetch<Session>("/auth/me")
      .then(setSession)
      .catch((err) => {
        setError(err.message);
        router.replace("/login");
      });
  }, [router]);

  if (error) return <div className="empty-state">{error}</div>;
  if (!session) return <div className="empty-state">Cargando sesion...</div>;

  return <>{children(session)}</>;
}
