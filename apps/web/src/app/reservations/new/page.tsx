"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { paymentMethodLabels, paymentMethods, permissions } from "@hotel-pms/shared";
import type { PaymentMethod } from "@hotel-pms/shared";
import { Protected } from "../../../components/protected";
import { Shell } from "../../../components/shell";
import { apiFetch } from "../../../lib/api";

type Room = {
  id: string;
  number: string;
  floor?: string | null;
  block?: string | null;
  roomTypeId: string;
  roomType: { id: string; code: string; name: string };
};

type FormState = {
  firstName: string;
  lastName: string;
  documentNumber: string;
  email: string;
  phone: string;
  roomTypeId: string;
  assignedRoomId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: string;
  children: string;
  totalAmount: string;
  depositAmount: string;
  depositPaid: boolean;
  depositMethod: PaymentMethod;
  depositReference: string;
  source: string;
  notes: string;
};

type CreatedReservation = {
  code: string;
  assignedRoom?: { id: string; number: string } | null;
};

export default function NewReservationPage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <NewReservationContent permissionsList={session.permissions} />
        </Shell>
      )}
    </Protected>
  );
}

function NewReservationContent({ permissionsList }: { permissionsList: string[] }) {
  const canCreate = permissionsList.includes(permissions.reservationCreate);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState<FormState>(() => initialForm());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const roomRows = await apiFetch<Room[]>("/rooms");
    setRooms(roomRows);

    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("roomId") ?? "";
    const checkIn = params.get("checkIn") ?? "";
    const checkOut = params.get("checkOut") ?? "";
    const room = roomRows.find((row) => row.id === roomId);
    const firstTypeId = roomRows[0]?.roomType.id ?? "";

    setForm((current) => ({
      ...current,
      roomTypeId: (room?.roomType.id ?? current.roomTypeId) || firstTypeId,
      assignedRoomId: room?.id ?? current.assignedRoomId,
      checkInDate: checkIn || current.checkInDate,
      checkOutDate: checkOut || current.checkOutDate,
    }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const roomTypes = useMemo(() => {
    const map = new Map<string, Room["roomType"]>();
    for (const room of rooms) map.set(room.roomType.id, room.roomType);
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [rooms]);

  const selectedRoom = rooms.find((room) => room.id === form.assignedRoomId);
  const assignableRooms = rooms.filter((room) => room.roomType.id === form.roomTypeId);
  const formHasDepositAmount = Number(form.depositAmount || 0) > 0;

  async function createReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const reservation = await apiFetch<CreatedReservation>("/reservations", {
        method: "POST",
        body: JSON.stringify({
          guest: {
            firstName: form.firstName,
            lastName: form.lastName,
            documentType: form.documentNumber ? "DNI" : undefined,
            documentNumber: form.documentNumber || undefined,
            email: form.email || undefined,
            phone: form.phone || undefined,
          },
          roomTypeId: form.roomTypeId,
          assignedRoomId: form.assignedRoomId || null,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          adults: form.adults,
          children: form.children,
          totalAmount: form.totalAmount || undefined,
          depositAmount: form.depositAmount || undefined,
          depositPaid: formHasDepositAmount ? form.depositPaid : false,
          depositMethod: formHasDepositAmount && form.depositPaid ? form.depositMethod : undefined,
          depositReference:
            formHasDepositAmount && form.depositPaid ? form.depositReference || undefined : undefined,
          source: form.source,
          notes: form.notes || undefined,
        }),
      });
      setMessage(`Reserva ${reservation.code} creada.`);
      setForm((current) => ({
        ...initialForm(current.roomTypeId),
        assignedRoomId: current.assignedRoomId,
        checkInDate: current.checkInDate,
        checkOutDate: current.checkOutDate,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la reserva.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Nueva reserva</h1>
          <p>
            {selectedRoom
              ? `Habitacion ${selectedRoom.number} - ${formatDate(form.checkInDate)} a ${formatDate(form.checkOutDate)}`
              : `${formatDate(form.checkInDate)} a ${formatDate(form.checkOutDate)}`}
          </p>
        </div>
        <a className="secondary-link" href={`/calendar?start=${form.checkInDate}`}>
          Calendario
        </a>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <section className="reservation-create-page">
        <form className="panel form-panel reservation-create-form" onSubmit={createReservation}>
          <div className="form-grid two">
            <label>
              Nombre
              <input
                required
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              />
            </label>
            <label>
              Apellido
              <input
                required
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              />
            </label>
            <label>
              Documento
              <input
                value={form.documentNumber}
                onChange={(event) => setForm({ ...form, documentNumber: event.target.value })}
              />
            </label>
            <label>
              Telefono
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <label className="wide">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label>
              Llegada
              <input
                required
                type="date"
                value={form.checkInDate}
                onChange={(event) => setForm({ ...form, checkInDate: event.target.value })}
              />
            </label>
            <label>
              Salida
              <input
                required
                type="date"
                value={form.checkOutDate}
                onChange={(event) => setForm({ ...form, checkOutDate: event.target.value })}
              />
            </label>
            <label>
              Tipo
              <select
                required
                value={form.roomTypeId}
                onChange={(event) =>
                  setForm({ ...form, roomTypeId: event.target.value, assignedRoomId: "" })
                }
              >
                {roomTypes.map((roomType) => (
                  <option value={roomType.id} key={roomType.id}>
                    {roomType.code} - {roomType.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Habitacion
              <select
                value={form.assignedRoomId}
                onChange={(event) => setForm({ ...form, assignedRoomId: event.target.value })}
              >
                <option value="">Sin asignar</option>
                {assignableRooms.map((room) => (
                  <option value={room.id} key={room.id}>
                    {room.number}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Adultos
              <input
                min="1"
                type="number"
                value={form.adults}
                onChange={(event) => setForm({ ...form, adults: event.target.value })}
              />
            </label>
            <label>
              Menores
              <input
                min="0"
                type="number"
                value={form.children}
                onChange={(event) => setForm({ ...form, children: event.target.value })}
              />
            </label>
            <label>
              Total
              <input
                min="0"
                type="number"
                value={form.totalAmount}
                onChange={(event) => setForm({ ...form, totalAmount: event.target.value })}
              />
            </label>
            <label>
              Sena
              <input
                min="0"
                type="number"
                value={form.depositAmount}
                onChange={(event) => {
                  const depositAmount = event.target.value;
                  setForm({
                    ...form,
                    depositAmount,
                    depositPaid: Number(depositAmount || 0) > 0 ? form.depositPaid : false,
                  });
                }}
              />
            </label>
            <label className="checkbox-line wide">
              <input
                type="checkbox"
                checked={form.depositPaid}
                disabled={!formHasDepositAmount}
                onChange={(event) => setForm({ ...form, depositPaid: event.target.checked })}
              />
              Sena pagada
            </label>
            {formHasDepositAmount && form.depositPaid ? (
              <>
                <label>
                  Medio de sena
                  <select
                    value={form.depositMethod}
                    onChange={(event) =>
                      setForm({ ...form, depositMethod: event.target.value as PaymentMethod })
                    }
                  >
                    {paymentMethods.map((method) => (
                      <option value={method} key={method}>
                        {paymentMethodLabels[method]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Referencia
                  <input
                    value={form.depositReference}
                    onChange={(event) => setForm({ ...form, depositReference: event.target.value })}
                  />
                </label>
              </>
            ) : null}
            <label className="wide">
              Origen
              <select
                value={form.source}
                onChange={(event) => setForm({ ...form, source: event.target.value })}
              >
                <option value="direct">Directa</option>
                <option value="phone">Telefono</option>
                <option value="online_csv">Online importada</option>
                <option value="walk_in">Walk-in</option>
              </select>
            </label>
            <label className="wide">
              Notas
              <input
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
          </div>
          <button className="primary-button" disabled={!canCreate || loading}>
            {loading ? "Guardando..." : "Crear reserva"}
          </button>
        </form>
      </section>
    </>
  );
}

function initialForm(roomTypeId = ""): FormState {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return {
    firstName: "",
    lastName: "",
    documentNumber: "",
    email: "",
    phone: "",
    roomTypeId,
    assignedRoomId: "",
    checkInDate: toDateInput(today),
    checkOutDate: toDateInput(tomorrow),
    adults: "2",
    children: "0",
    totalAmount: "",
    depositAmount: "",
    depositPaid: false,
    depositMethod: "cash",
    depositReference: "",
    source: "direct",
    notes: "",
  };
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}
