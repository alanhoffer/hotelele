"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  DoorOpen,
  Eye,
  Plus,
  Search,
} from "lucide-react";
import {
  paymentMethodLabels,
  paymentMethods,
  permissions,
  reservationStatuses,
  statusLabels,
} from "@hotel-pms/shared";
import type { PaymentMethod } from "@hotel-pms/shared";
import { Protected } from "../../components/protected";
import {
  ReservationOperationalDrawer,
  type ReservationRoomingPatch,
  type ReservationUpdatePatch,
} from "../../components/reservation-operational-drawer";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

type Room = {
  id: string;
  number: string;
  floor?: string | null;
  block?: string | null;
  capacity?: number | null;
  commercialStatus?: string | null;
  cleaningStatus?: string | null;
  maintenanceStatus?: string | null;
  roomTypeId: string;
  roomType: { id: string; code: string; name: string };
};

type Reservation = {
  id: string;
  code: string;
  status: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  currency: string;
  nightlyRate?: string | number | null;
  totalAmount?: string | number | null;
  depositAmount?: string | number | null;
  depositPaid: boolean;
  depositMethod?: PaymentMethod | null;
  depositReference?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  guest: {
    firstName: string;
    lastName: string;
    documentType?: string | null;
    documentNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    nationality?: string | null;
    notes?: string | null;
  };
  roomType: { id: string; code: string; name: string };
  assignedRoom?: { id: string; number: string } | null;
  occupants?: {
    id?: string;
    firstName: string;
    lastName: string;
    documentType?: string | null;
    documentNumber?: string | null;
    phone?: string | null;
    nationality?: string | null;
    ageCategory: "adult" | "child";
    primary: boolean;
  }[];
  stay?: {
    id: string;
    status: string;
    checkedInAt?: string | null;
    checkedOutAt?: string | null;
  } | null;
  folio?: {
    id: string;
    status: string;
    currency: string;
    openedAt: string;
    closedAt?: string | null;
    charges?: {
      id: string;
      kind: "lodging" | "extra" | "minibar" | "laundry" | "food" | "beverage" | "parking" | "adjustment";
      description: string;
      quantity: number;
      unitAmount: string | number;
      totalAmount: string | number;
      postedAt: string;
    }[];
    payments?: {
      id: string;
      method: PaymentMethod;
      currency: string;
      amount: string | number;
      reference?: string | null;
      paidAt: string;
    }[];
    invoices?: {
      id: string;
      type: "invoice" | "credit_note" | "debit_note" | "internal_receipt";
      status: "draft" | "pending_afip" | "authorized" | "rejected" | "cancelled";
      pointOfSale?: string | null;
      number?: string | null;
      cae?: string | null;
      totalAmount: string | number;
      issuedAt?: string | null;
      createdAt: string;
    }[];
  } | null;
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

export default function ReservationsPage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <ReservationsContent permissionsList={session.permissions} />
        </Shell>
      )}
    </Protected>
  );
}

function ReservationsContent({ permissionsList }: { permissionsList: string[] }) {
  const canCreate = permissionsList.includes(permissions.reservationCreate);
  const canUpdate = permissionsList.includes(permissions.reservationUpdate);
  const canCheckIn = permissionsList.includes(permissions.reservationCheckIn);
  const canCheckOut = permissionsList.includes(permissions.reservationCheckOut);
  const canCreateInvoice = permissionsList.includes(permissions.invoiceCreate);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => initialForm());

  async function load() {
    const [reservationRows, roomRows] = await Promise.all([
      apiFetch<Reservation[]>("/reservations"),
      apiFetch<Room[]>("/rooms"),
    ]);
    setReservations(reservationRows);
    setRooms(roomRows);
    setForm((current) => ({
      ...current,
      roomTypeId: current.roomTypeId || roomRows[0]?.roomType.id || "",
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

  const assignableRooms = rooms.filter((room) => room.roomType.id === form.roomTypeId);
  const visibleReservations = useMemo(() => {
    const guestQuery = normalizeSearch(searchTerm);
    const roomQuery = normalizeSearch(roomSearch);
    return reservations.filter((reservation) => {
      const statusMatches =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? ["pending", "confirmed", "assigned", "in_house"].includes(reservation.status)
            : reservation.status === statusFilter;

      if (!statusMatches) return false;

      const generalHaystack = normalizeSearch(
        [
          reservation.code,
          reservation.guest.firstName,
          reservation.guest.lastName,
          `${reservation.guest.firstName} ${reservation.guest.lastName}`,
          `${reservation.guest.lastName} ${reservation.guest.firstName}`,
          reservation.guest.documentNumber,
          reservation.guest.email,
          reservation.guest.phone,
          reservation.assignedRoom?.number,
          reservation.roomType.code,
          reservation.roomType.name,
        ]
          .filter(Boolean)
          .join(" "),
      );

      const roomHaystack = normalizeSearch(
        [reservation.assignedRoom?.number, reservation.roomType.code, reservation.roomType.name]
          .filter(Boolean)
          .join(" "),
      );

      return matchesQuery(generalHaystack, guestQuery) && matchesQuery(roomHaystack, roomQuery);
    });
  }, [reservations, roomSearch, searchTerm, statusFilter]);
  const hasSearchFilters =
    Boolean(normalizeSearch(searchTerm)) || Boolean(normalizeSearch(roomSearch)) || statusFilter !== "active";
  const formHasDepositAmount = Number(form.depositAmount || 0) > 0;
  const selectedReservation = selectedReservationId
    ? reservations.find((reservation) => reservation.id === selectedReservationId) ?? null
    : null;
  const selectedReservationRoom = selectedReservation?.assignedRoom
    ? rooms.find((room) => room.id === selectedReservation.assignedRoom?.id) ?? null
    : null;

  async function createReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/reservations", {
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
      setForm(initialForm(form.roomTypeId));
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la reserva.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(reservation: Reservation, action: "confirm" | "cancel" | "check-in" | "check-out") {
    setError(null);
    setBusyAction(action);
    try {
      await apiFetch(`/reservations/${reservation.id}/${action}`, {
        method: "POST",
        body: action === "cancel" ? JSON.stringify({ reason: "Cancelacion desde tablero" }) : "{}",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la accion.");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateReservation(reservation: Reservation, patch: ReservationUpdatePatch) {
    setError(null);
    setBusyAction("update");
    try {
      await apiFetch(`/reservations/${reservation.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la reserva.");
    } finally {
      setBusyAction(null);
    }
  }

  async function replaceReservationOccupants(reservation: Reservation, patch: ReservationRoomingPatch) {
    setError(null);
    setBusyAction("rooming");
    try {
      await apiFetch(`/reservations/${reservation.id}/occupants`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la rooming list.");
    } finally {
      setBusyAction(null);
    }
  }

  function openReservationCalendar(reservation: Reservation) {
    const params = new URLSearchParams({
      start: reservation.checkInDate.slice(0, 10),
    });
    if (reservation.assignedRoom?.id) params.set("roomId", reservation.assignedRoom.id);
    window.location.assign(`/calendar?${params.toString()}`);
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Buscar reservas</h1>
          <p>Consulta por nombre, apellido, codigo, documento, telefono o habitacion.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" onClick={() => setCreateOpen((current) => !current)}>
            <Plus size={15} />
            Nueva manual
          </button>
          <button className="primary-button" type="button" onClick={() => window.location.assign("/calendar")}>
            <CalendarDays size={15} />
            Crear en calendario
          </button>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="panel reservation-search-panel" aria-label="Buscador de reservas">
        <div className="section-title-row">
          <div>
            <h2>Buscador</h2>
            <p className="muted-text">Filtra la lista sin salir al calendario ni al tablero.</p>
          </div>
          <div className="reservation-search-actions">
            {hasSearchFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setRoomSearch("");
                  setStatusFilter("active");
                }}
              >
                Limpiar
              </button>
            ) : null}
            <button
              aria-expanded={createOpen}
              className={`reservation-create-toggle ${createOpen ? "active" : ""}`}
              type="button"
              onClick={() => setCreateOpen((current) => !current)}
            >
              <Plus size={15} />
              Crear reserva
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
        <div className="reservation-search-grid">
          <label>
            Huesped, codigo o contacto
            <span className="reservation-search-input">
              <Search size={15} />
              <input
                type="search"
                placeholder="Nombre, apellido, codigo, telefono o documento"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </span>
          </label>
          <label>
            Habitacion
            <input
              type="search"
              placeholder="Ej. 103, 105 o Estandar"
              value={roomSearch}
              onChange={(event) => setRoomSearch(event.target.value)}
            />
          </label>
          <label>
            Estado
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="active">Activas</option>
              <option value="all">Todas</option>
              {reservationStatuses.map((status) => (
                <option value={status} key={status}>
                  {statusLabels[status] ?? status}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="search-summary">
          <strong>{visibleReservations.length}</strong>
          <span>
            {visibleReservations.length === 1 ? "reserva encontrada" : "reservas encontradas"}
          </span>
        </div>
      </section>

      {createOpen ? (
        <section className="panel reservation-create-panel">
        <form className="form-panel reservation-manual-form" onSubmit={createReservation}>
          <div className="section-title-row">
            <div>
              <h2>Crear reserva manual</h2>
              <p className="muted-text">Para elegir fechas visualmente, usa el calendario.</p>
            </div>
            <button type="button" onClick={() => setCreateOpen(false)}>
              Cerrar
            </button>
          </div>
          <div className="reservation-create-shortcuts">
            <button className="secondary-link" type="button" onClick={() => window.location.assign("/calendar")}>
              <CalendarDays size={15} />
              Crear desde calendario
            </button>
          </div>
          <div className="form-grid two reservation-create-form-grid">
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
            <label>
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
            <label className="checkbox-line">
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
            <label>
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
      ) : null}

      <section className="reservations-results-panel">
        <div className="section-title-row reservations-results-header">
          <div>
            <h2>Reservas encontradas</h2>
            <p className="muted-text">Lista compacta para abrir detalle o ejecutar acciones rapidas.</p>
          </div>
          <div className="reservation-result-count">
            <strong>{visibleReservations.length}</strong>
            <span>{visibleReservations.length === 1 ? "resultado" : "resultados"}</span>
          </div>
        </div>

        <section className="reservations-list reservation-list-modern">
          {visibleReservations.length === 0 ? (
            <article className="panel empty-state reservation-empty-state">
              <h2>No encontramos reservas</h2>
              <p>Proba buscar por apellido, nombre, numero de habitacion, codigo o documento.</p>
            </article>
          ) : null}
          {visibleReservations.map((reservation) => {
            const depositAmount = Number(reservation.depositAmount ?? 0);
            const pax = reservation.adults + reservation.children;
            return (
              <article
                className={`reservation-list-row reservation-row-${reservationStatusTone(reservation.status)}`}
                key={reservation.id}
              >
                <div className="reservation-row-status">
                  <StatusBadge value={reservation.status} />
                  <small>{sourceLabel(reservation.source)}</small>
                </div>
                <div className="reservation-row-main">
                  <div>
                    <strong>
                      {reservation.guest.lastName}, {reservation.guest.firstName}
                    </strong>
                    <span>
                      {reservation.code} - {reservation.guest.phone || reservation.guest.documentNumber || "Sin contacto"}
                    </span>
                  </div>
                  <button type="button" onClick={() => setSelectedReservationId(reservation.id)}>
                    <Eye size={15} />
                    Ver detalle
                  </button>
                </div>
                <div className="reservation-row-facts">
                  <span>
                    <CalendarDays size={14} />
                    {formatDateShort(reservation.checkInDate)} - {formatDateShort(reservation.checkOutDate)}
                  </span>
                  <span>
                    <DoorOpen size={14} />
                    Hab. {reservation.assignedRoom?.number ?? "sin asignar"}
                  </span>
                  <span>
                    {reservation.roomType.code} - {pax} pax
                  </span>
                  <span className={depositAmount > 0 && !reservation.depositPaid ? "warn-text" : ""}>
                    <CreditCard size={14} />
                    {depositAmount > 0
                      ? `${formatMoney(depositAmount, reservation.currency)} ${reservation.depositPaid ? "pagada" : "pendiente"}`
                      : "Sin sena"}
                  </span>
                </div>
                <div className="reservation-row-actions">
                  {reservation.status === "pending" && canUpdate ? (
                    <button onClick={() => runAction(reservation, "confirm")} type="button">
                      <Check size={14} />
                      Confirmar
                    </button>
                  ) : null}
                  {["pending", "confirmed", "assigned"].includes(reservation.status) && canUpdate ? (
                    <button onClick={() => runAction(reservation, "cancel")} type="button">
                      <Ban size={14} />
                      Cancelar
                    </button>
                  ) : null}
                  {["confirmed", "assigned"].includes(reservation.status) && canCheckIn ? (
                    <button className="primary-button" onClick={() => runAction(reservation, "check-in")} type="button">
                      <DoorOpen size={14} />
                      Check-in
                    </button>
                  ) : null}
                  {reservation.status === "in_house" && canCheckOut ? (
                    <button className="primary-button" onClick={() => runAction(reservation, "check-out")} type="button">
                      <DoorOpen size={14} />
                      Check-out
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      </section>


      {selectedReservation ? (
        <ReservationOperationalDrawer
          busyAction={busyAction}
          canCheckIn={canCheckIn}
          canCheckOut={canCheckOut}
          canCreateInvoice={canCreateInvoice}
          canUpdate={canUpdate}
          onCancel={(reservation) => runAction(reservation as Reservation, "cancel")}
          onCheckIn={(reservation) => runAction(reservation as Reservation, "check-in")}
          onCheckOut={(reservation) => runAction(reservation as Reservation, "check-out")}
          onClose={() => setSelectedReservationId(null)}
          onConfirm={(reservation) => runAction(reservation as Reservation, "confirm")}
          onOpenCalendar={(reservation) => openReservationCalendar(reservation as Reservation)}
          onOpenRoom={(roomId) => {
            window.location.href = `/room-board?roomId=${roomId}`;
          }}
          onReplaceOccupants={(reservation, patch) =>
            replaceReservationOccupants(reservation as Reservation, patch)
          }
          onUpdate={(reservation, patch) => updateReservation(reservation as Reservation, patch)}
          reservation={selectedReservation}
          room={selectedReservationRoom}
        />
      ) : null}
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
  return new Date(value).toLocaleDateString();
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function formatMoney(value: number, currency = "ARS") {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }
}

function sourceLabel(source?: string | null) {
  const labels: Record<string, string> = {
    direct: "Directa",
    phone: "Telefono",
    online_csv: "Online",
    walk_in: "Walk-in",
  };
  return source ? labels[source] ?? source : "Sin origen";
}

function reservationStatusTone(status: string) {
  if (status === "cancelled" || status === "no_show") return "bad";
  if (status === "pending") return "warn";
  if (status === "in_house") return "good";
  if (status === "completed") return "done";
  return "active";
}

function normalizeSearch(value?: string | number | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesQuery(haystack: string, query: string) {
  if (!query) return true;
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "cancelled" || value === "no_show"
      ? "bad"
      : value === "pending"
        ? "warn"
        : "";
  return <span className={`badge ${tone}`}>{statusLabels[value] ?? value}</span>;
}
