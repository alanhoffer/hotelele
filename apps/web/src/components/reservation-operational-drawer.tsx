"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  FileText,
  History,
  Home,
  Pencil,
  ReceiptText,
  Save,
  ScanLine,
  Sparkles,
  Smartphone,
  UserRound,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import {
  chargeKindLabels,
  invoiceStatusLabels,
  invoiceTypeLabels,
  paymentMethodLabels,
  paymentMethods,
  statusLabels,
} from "@hotel-pms/shared";
import type { ChargeKind, InvoiceStatus, InvoiceType, PaymentMethod } from "@hotel-pms/shared";
import { apiFetch } from "../lib/api";
import type { ParsedArgentineDni } from "../lib/argentine-dni";

export type ReservationDrawerRoom = {
  id: string;
  number: string;
  floor?: string | null;
  block?: string | null;
  capacity?: number | null;
  commercialStatus?: string | null;
  cleaningStatus?: string | null;
  maintenanceStatus?: string | null;
  roomType?: { id?: string; code: string; name: string } | null;
};

export type OperationalReservation = {
  id: string;
  code: string;
  status: string;
  source?: string | null;
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
  roomType: { id?: string; code: string; name: string };
  assignedRoom?: ReservationDrawerRoom | null;
  occupants?: ReservationOccupant[];
  stay?: {
    id: string;
    status: string;
    checkedInAt?: string | null;
    checkedOutAt?: string | null;
  } | null;
  folio?: ReservationFolio | null;
};

type ReservationOccupant = {
  id?: string;
  firstName: string;
  lastName: string;
  documentType?: string | null;
  documentNumber?: string | null;
  phone?: string | null;
  nationality?: string | null;
  ageCategory: "adult" | "child";
  primary: boolean;
};

type ReservationGuestRow = {
  key: string;
  firstName: string;
  lastName: string;
  documentType?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  notes?: string | null;
  ageCategory: "adult" | "child";
  primary: boolean;
  pending: boolean;
};

type ReservationFolio = {
  id: string;
  status: string;
  currency: string;
  openedAt: string;
  closedAt?: string | null;
  charges?: {
    id: string;
    kind: ChargeKind;
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
    type: InvoiceType;
    status: InvoiceStatus;
    pointOfSale?: string | null;
    number?: string | null;
    cae?: string | null;
    totalAmount: string | number;
    issuedAt?: string | null;
    createdAt: string;
  }[];
};

type ReservationOperationalDrawerProps = {
  reservation: OperationalReservation;
  room?: ReservationDrawerRoom | null;
  busyAction?: string | null;
  canUpdate?: boolean;
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  canCreateInvoice?: boolean;
  onClose: () => void;
  onUpdate?: (reservation: OperationalReservation, patch: ReservationUpdatePatch) => void | Promise<void>;
  onReplaceOccupants?: (reservation: OperationalReservation, patch: ReservationRoomingPatch) => void | Promise<void>;
  onOpenRoom?: (roomId: string) => void;
  onOpenCalendar?: (reservation: OperationalReservation) => void;
  onOpenReservations?: () => void;
  onConfirm?: (reservation: OperationalReservation) => void | Promise<void>;
  onCancel?: (reservation: OperationalReservation) => void | Promise<void>;
  onCheckIn?: (reservation: OperationalReservation) => void | Promise<void>;
  onCheckOut?: (reservation: OperationalReservation) => void | Promise<void>;
};

const DEFAULT_CHECK_IN_TIME = "15:00";
const DEFAULT_CHECK_OUT_TIME = "11:00";

type ReservationDetailTab = "summary" | "guests" | "account" | "operation" | "history" | "calendar";
type ReservationInlinePanel = "summary" | "guest" | "deposit" | "rooming" | null;

type RemoteDocumentScanRequest = {
  id: string;
  reservationId: string;
  reservationCode?: string;
  occupantIndex: number;
  occupantLabel?: string;
  status: "waiting" | "received";
  createdAt: string;
  expiresAt: string;
  result?: {
    parsed?: ParsedArgentineDni;
    imageDataUrl?: string;
    note?: string;
    receivedAt: string;
  };
};

export type ReservationUpdatePatch = {
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
  children?: number;
  nightlyRate?: number | null;
  totalAmount?: number | null;
  depositAmount?: number | null;
  depositPaid?: boolean;
  depositMethod?: PaymentMethod | null;
  depositReference?: string | null;
  source?: string;
  notes?: string | null;
  guest?: {
    firstName?: string;
    lastName?: string;
    documentType?: string | null;
    documentNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    nationality?: string | null;
    notes?: string | null;
  };
};

export type ReservationRoomingPatch = {
  adults: number;
  children: number;
  occupants: ReservationRoomingOccupant[];
};

export type ReservationRoomingOccupant = {
  firstName: string;
  lastName: string;
  documentType: string | null;
  documentNumber: string | null;
  phone: string | null;
  nationality: string | null;
  ageCategory: "adult" | "child";
  primary: boolean;
};

type ReservationSummaryForm = {
  checkInDate: string;
  checkOutDate: string;
  adults: string;
  children: string;
  nightlyRate: string;
  totalAmount: string;
  source: string;
  notes: string;
};

type ReservationGuestForm = {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  nationality: string;
  notes: string;
};

type RoomingOccupantForm = {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  phone: string;
  nationality: string;
  ageCategory: "adult" | "child";
  primary: boolean;
};

type RoomingForm = {
  adults: string;
  children: string;
  occupants: RoomingOccupantForm[];
};

type ReservationDepositForm = {
  depositAmount: string;
  depositPaid: boolean;
  depositMethod: PaymentMethod;
  depositReference: string;
};

const reservationDetailTabs: { key: ReservationDetailTab; label: string }[] = [
  { key: "summary", label: "Resumen" },
  { key: "guests", label: "Huespedes" },
  { key: "account", label: "Cuenta" },
  { key: "operation", label: "Operacion" },
  { key: "history", label: "Historial" },
  { key: "calendar", label: "Calendario" },
];

export function ReservationOperationalDrawer({
  reservation,
  room,
  busyAction,
  canUpdate = false,
  canCheckIn = false,
  canCheckOut = false,
  canCreateInvoice = false,
  onClose,
  onUpdate,
  onReplaceOccupants,
  onOpenRoom,
  onOpenCalendar,
  onOpenReservations,
  onConfirm,
  onCancel,
  onCheckIn,
  onCheckOut,
}: ReservationOperationalDrawerProps) {
  const [activeTab, setActiveTab] = useState<ReservationDetailTab>("summary");
  const [inlinePanel, setInlinePanel] = useState<ReservationInlinePanel>(null);
  const [summaryForm, setSummaryForm] = useState<ReservationSummaryForm>(() => buildSummaryForm(reservation));
  const [guestForm, setGuestForm] = useState<ReservationGuestForm>(() => buildGuestForm(reservation));
  const [roomingForm, setRoomingForm] = useState<RoomingForm>(() => buildRoomingForm(reservation));
  const [activeGuestPanel, setActiveGuestPanel] = useState<number | null>(() =>
    firstIncompleteRoomingIndex(buildRoomingForm(reservation)),
  );
  const [roomingError, setRoomingError] = useState<string | null>(null);
  const [documentScanRequest, setDocumentScanRequest] = useState<RemoteDocumentScanRequest | null>(null);
  const [documentScanMessage, setDocumentScanMessage] = useState<string | null>(null);
  const [documentScanImage, setDocumentScanImage] = useState<string | null>(null);
  const [depositForm, setDepositForm] = useState<ReservationDepositForm>(() => buildDepositForm(reservation));
  const effectiveRoom = room ?? reservation.assignedRoom ?? null;
  const stay = stayFacts(reservation);
  const folio = folioFacts(reservation);
  const flow = reservationFlow(reservation, effectiveRoom, stay, folio);
  const alerts = reservationAlerts(reservation, effectiveRoom, stay, folio);
  const primaryAction = buildPrimaryAction({
    reservation,
    room: effectiveRoom,
    flowKind: flow.kind,
    canUpdate,
    canCheckIn,
    canCheckOut,
    canCreateInvoice,
    onOpenRoom,
    onConfirm,
    onCheckIn,
    onCheckOut,
  });
  const totalPax = reservation.adults + reservation.children;
  const completeOccupants = countCompleteOccupants(reservation.occupants ?? []);
  const roomingComplete = completeOccupants >= totalPax;
  const guestRows = buildReservationGuestRows(reservation);
  const guestsWithDocument = guestRows.filter((guest) => !guest.pending && guest.documentNumber?.trim()).length;
  const guestsWithContact = guestRows.filter((guest) => !guest.pending && (guest.phone?.trim() || guest.email?.trim())).length;
  const guestsWithNationality = guestRows.filter((guest) => !guest.pending && guest.nationality?.trim()).length;
  const latestInvoice = folio.invoices[0];
  const canEditReservation = Boolean(
    onUpdate && canUpdate && ["pending", "confirmed", "assigned"].includes(reservation.status),
  );
  const canEditGuestContact = Boolean(
    onUpdate && canUpdate && ["pending", "confirmed", "assigned", "in_house"].includes(reservation.status),
  );
  const canEditRooming = Boolean(
    onReplaceOccupants &&
      canUpdate &&
      ["pending", "confirmed", "assigned", "in_house"].includes(reservation.status),
  );
  const isGuestReadOnly = ["completed", "cancelled", "no_show"].includes(reservation.status);

  useEffect(() => {
    setSummaryForm(buildSummaryForm(reservation));
    setGuestForm(buildGuestForm(reservation));
    setRoomingForm(buildRoomingForm(reservation));
    setActiveGuestPanel(firstIncompleteRoomingIndex(buildRoomingForm(reservation)));
    setRoomingError(null);
    setDocumentScanRequest(null);
    setDocumentScanMessage(null);
    setDocumentScanImage(null);
    setDepositForm(buildDepositForm(reservation));
  }, [reservation]);

  useEffect(() => {
    if (!documentScanRequest || documentScanRequest.status !== "waiting") return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const nextRequest = await apiFetch<RemoteDocumentScanRequest>(
          `/document-scans/requests/${documentScanRequest.id}`,
        );
        if (cancelled) return;
        if (nextRequest.status === "received" && nextRequest.result) {
          applyDocumentScanResult(nextRequest.occupantIndex, nextRequest.result);
          await apiFetch(`/document-scans/requests/${nextRequest.id}/consume`, { method: "POST" });
          if (!cancelled) setDocumentScanRequest(null);
          return;
        }
        setDocumentScanRequest(nextRequest);
      } catch (err) {
        if (!cancelled) {
          setDocumentScanRequest(null);
          setDocumentScanMessage(err instanceof Error ? err.message : "El pedido de escaneo ya no esta activo.");
        }
      }
    }, 1800);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [documentScanRequest]);

  useEffect(() => {
    setInlinePanel(null);
    setActiveTab("summary");
  }, [reservation.id]);

  async function submitSummaryUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onUpdate || !canEditReservation) return;
    await onUpdate(reservation, {
      checkInDate: summaryForm.checkInDate,
      checkOutDate: summaryForm.checkOutDate,
      adults: Number(summaryForm.adults),
      children: Number(summaryForm.children),
      nightlyRate: nullableNumber(summaryForm.nightlyRate),
      totalAmount: nullableNumber(summaryForm.totalAmount),
      source: summaryForm.source,
      notes: summaryForm.notes.trim() || null,
    });
    setInlinePanel(null);
  }

  async function submitGuestUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onUpdate || !canEditGuestContact) return;
    await onUpdate(reservation, {
      guest: {
        firstName: guestForm.firstName,
        lastName: guestForm.lastName,
        documentType: guestForm.documentType.trim() || null,
        documentNumber: guestForm.documentNumber.trim() || null,
        email: guestForm.email.trim() || null,
        phone: guestForm.phone.trim() || null,
        nationality: guestForm.nationality.trim() || null,
        notes: guestForm.notes.trim() || null,
      },
    });
    setInlinePanel(null);
  }

  async function submitRoomingUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onReplaceOccupants || !canEditRooming) return;
    const normalizedForm = resizeRoomingForm(roomingForm);
    setRoomingForm(normalizedForm);
    const missingIndex = normalizedForm.occupants.findIndex(
      (occupant) => !occupant.firstName.trim() || !occupant.lastName.trim(),
    );
    if (missingIndex >= 0) {
      setActiveGuestPanel(missingIndex);
      setRoomingError("Cada huesped necesita nombre y apellido antes de guardar.");
      return;
    }
    setRoomingError(null);
    await onReplaceOccupants(reservation, {
      adults: Number(normalizedForm.adults),
      children: Number(normalizedForm.children),
      occupants: normalizeRoomingOccupants(normalizedForm.occupants),
    });
    setInlinePanel(null);
  }

  async function submitDepositUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onUpdate || !canEditReservation) return;
    const amount = nullableNumber(depositForm.depositAmount);
    await onUpdate(reservation, {
      depositAmount: amount,
      depositPaid: amount ? depositForm.depositPaid : false,
      depositMethod: amount && depositForm.depositPaid ? depositForm.depositMethod : null,
      depositReference: amount && depositForm.depositPaid ? depositForm.depositReference.trim() || null : null,
    });
    setInlinePanel(null);
  }

  function openPanel(tab: ReservationDetailTab, panel: Exclude<ReservationInlinePanel, null>) {
    setActiveTab(tab);
    setInlinePanel((current) => (current === panel ? null : panel));
  }

  function openRoomingPanel() {
    const nextForm = buildRoomingForm(reservation);
    setRoomingForm(nextForm);
    setActiveGuestPanel(firstIncompleteRoomingIndex(nextForm));
    setRoomingError(null);
    openPanel("guests", "rooming");
  }

  function updateRoomingCount(kind: "adults" | "children", value: string) {
    setRoomingError(null);
    setRoomingForm((current) => {
      const next = resizeRoomingForm({ ...current, [kind]: value });
      setActiveGuestPanel((panel) => {
        if (panel === null) return firstIncompleteRoomingIndex(next);
        return Math.min(panel, next.occupants.length - 1);
      });
      return next;
    });
  }

  function updateRoomingOccupant(index: number, patch: Partial<RoomingOccupantForm>) {
    setRoomingError(null);
    setRoomingForm((current) => ({
      ...current,
      occupants: current.occupants.map((occupant, occupantIndex) =>
        occupantIndex === index ? { ...occupant, ...patch } : occupant,
      ),
    }));
  }

  function updateRoomingOccupantAge(index: number, ageCategory: RoomingOccupantForm["ageCategory"]) {
    setRoomingError(null);
    setRoomingForm((current) => {
      const occupants = current.occupants.map((occupant, occupantIndex) =>
        occupantIndex === index ? { ...occupant, ageCategory } : occupant,
      );
      const adults = Math.max(1, occupants.filter((occupant) => occupant.ageCategory === "adult").length);
      const children = occupants.filter((occupant) => occupant.ageCategory === "child").length;
      return resizeRoomingForm({
        adults: String(adults),
        children: String(children),
        occupants,
      });
    });
  }

  function markRoomingPrimary(index: number) {
    setRoomingError(null);
    setRoomingForm((current) => ({
      ...current,
      occupants: current.occupants.map((occupant, occupantIndex) => ({
        ...occupant,
        primary: occupantIndex === index,
      })),
    }));
  }

  async function startDocumentScan(index: number) {
    const occupant = roomingForm.occupants[index];
    const label =
      occupant.firstName || occupant.lastName
        ? `${occupant.firstName} ${occupant.lastName}`.trim()
        : occupant.primary
          ? "Titular"
          : `Huesped ${index + 1}`;

    setDocumentScanMessage(null);
    setDocumentScanImage(null);
    try {
      const request = await apiFetch<RemoteDocumentScanRequest>("/document-scans/requests", {
        method: "POST",
        body: JSON.stringify({
          reservationId: reservation.id,
          reservationCode: reservation.code,
          occupantIndex: index,
          occupantLabel: label,
        }),
      });
      setActiveGuestPanel(index);
      setDocumentScanRequest(request);
      setDocumentScanMessage("Pedido creado. Abrir /document-scanner en el celular con este mismo usuario.");
    } catch (err) {
      setDocumentScanMessage(err instanceof Error ? err.message : "No se pudo crear el pedido de escaneo.");
    }
  }

  function applyDocumentScanResult(
    index: number,
    result: NonNullable<RemoteDocumentScanRequest["result"]>,
  ) {
    const parsed = result.parsed ?? { confidence: "low" };
    setActiveGuestPanel(index);
    setRoomingForm((current) => ({
      ...current,
      occupants: current.occupants.map((occupant, occupantIndex) =>
        occupantIndex === index
          ? {
              ...occupant,
              firstName: parsed.firstName || occupant.firstName,
              lastName: parsed.lastName || occupant.lastName,
              documentType: parsed.documentType || occupant.documentType || "DNI",
              documentNumber: parsed.documentNumber || occupant.documentNumber,
              nationality: parsed.nationality || occupant.nationality || "Argentina",
            }
          : occupant,
      ),
    }));
    setDocumentScanImage(result.imageDataUrl ?? null);
    setDocumentScanMessage(
      parsed.documentNumber
        ? `Documento recibido para ${parsed.lastName ?? ""} ${parsed.firstName ?? ""}`.trim()
        : "Foto recibida. Revisar la imagen y completar los campos manualmente.",
    );
  }

  return (
    <>
      <button
        aria-label="Cerrar detalle de reserva"
        className="drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label={`Detalle de reserva ${reservation.code}`}
        aria-modal="true"
        className="panel reservation-detail-drawer"
        role="dialog"
      >
        <div className="reservation-detail-header">
          <button className="drawer-close" onClick={onClose} type="button">
            <X size={16} />
            Volver
          </button>
          <div className="reservation-detail-titlebar">
            <div>
              <span className="detail-kicker">Reserva</span>
              <h2>{reservation.code}</h2>
              <p>
                {reservation.guest.lastName}, {reservation.guest.firstName}
              </p>
            </div>
            <span className={`status-pill reservation-status-${reservation.status}`}>
              {statusLabels[reservation.status] ?? reservation.status}
            </span>
          </div>
          <nav className="reservation-detail-tabs" aria-label="Secciones de reserva">
            {reservationDetailTabs.map((tab) => (
              <button
                aria-selected={activeTab === tab.key}
                className={activeTab === tab.key ? "active" : ""}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="reservation-detail-body">
          <main className="reservation-detail-main">
            <section className={`reservation-flow-card ${flow.tone}`} hidden={activeTab !== "summary"}>
              <div className="reservation-flow-copy">
                <span className="detail-kicker">Siguiente accion</span>
                <h3>{flow.title}</h3>
                <p>{flow.description}</p>
              </div>
              {primaryAction ? (
                <button
                  className="primary-button"
                  disabled={primaryAction.disabled || busyAction === primaryAction.key}
                  onClick={primaryAction.onClick}
                  type="button"
                >
                  {primaryAction.icon}
                  {busyAction === primaryAction.key ? "Procesando..." : primaryAction.label}
                </button>
              ) : null}
            </section>

            {alerts.length ? (
              <section className="reservation-alert-strip" aria-label="Alertas operativas" hidden={activeTab !== "summary"}>
                {alerts.map((alert) => (
                  <div className={`reservation-alert ${alert.tone}`} key={alert.title}>
                    {alert.icon}
                    <div>
                      <strong>{alert.title}</strong>
                      <span>{alert.description}</span>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="reservation-section-card" hidden={activeTab !== "summary"}>
              <div className="section-title-row">
                <div>
                  <span className="detail-kicker">Estadia</span>
                  <h3>Fechas, habitacion y tarifa</h3>
                </div>
              </div>
              <div className="reservation-fact-grid">
                <Fact label="Ingreso" value={formatStayEndpoint(reservation.checkInDate, DEFAULT_CHECK_IN_TIME)} />
                <Fact label="Salida" value={formatStayEndpoint(reservation.checkOutDate, DEFAULT_CHECK_OUT_TIME)} />
                <Fact label="Noches" value={`${stay.nights} ${stay.nights === 1 ? "noche" : "noches"}`} />
                <Fact label="Pax" value={`${totalPax} pax`} hint={`${reservation.adults} adultos / ${reservation.children} menores`} />
                <Fact
                  label="Habitacion"
                  value={effectiveRoom ? `Hab. ${effectiveRoom.number}` : "Sin asignar"}
                  hint={effectiveRoom?.roomType ? `${effectiveRoom.roomType.code} - ${effectiveRoom.roomType.name}` : reservation.roomType.name}
                />
                <Fact label="Origen" value={sourceLabel(reservation.source)} />
                <Fact label="Total estadia" value={formatMoney(toNumber(reservation.totalAmount), reservation.currency)} />
                <Fact
                  label="Tarifa"
                  value={toNumber(reservation.nightlyRate) > 0 ? formatMoney(toNumber(reservation.nightlyRate), reservation.currency) : "Sin tarifa"}
                />
              </div>
              {reservation.notes ? (
                <div className="reservation-note">
                  <FileText size={16} />
                  <span>{reservation.notes}</span>
                </div>
              ) : null}
              <ReservationActionPanel
                title="Datos que se pueden modificar"
                items={[
                  "Fechas de entrada/salida antes del check-in",
                  "Cantidad de pax, tarifa, total, origen y notas",
                  "Asignacion o cambio de habitacion desde calendario/tablero",
                ]}
              />
              <div className="reservation-edit-toolbar">
                <button
                  disabled={!canEditReservation || busyAction === "update"}
                  onClick={() => openPanel("summary", "summary")}
                  type="button"
                >
                  <Pencil size={15} />
                  Editar detalle
                </button>
                {onOpenCalendar ? (
                  <button onClick={() => onOpenCalendar(reservation)} type="button">
                    <CalendarDays size={15} />
                    Ver calendario
                  </button>
                ) : null}
              </div>
              {inlinePanel === "summary" ? (
                <form className="reservation-inline-form" onSubmit={submitSummaryUpdate}>
                  <div className="form-grid two">
                    <label>
                      Llegada
                      <input
                        required
                        type="date"
                        value={summaryForm.checkInDate}
                        onChange={(event) => setSummaryForm({ ...summaryForm, checkInDate: event.target.value })}
                      />
                    </label>
                    <label>
                      Salida
                      <input
                        required
                        type="date"
                        value={summaryForm.checkOutDate}
                        onChange={(event) => setSummaryForm({ ...summaryForm, checkOutDate: event.target.value })}
                      />
                    </label>
                    <label>
                      Adultos
                      <input
                        min="1"
                        type="number"
                        value={summaryForm.adults}
                        onChange={(event) => setSummaryForm({ ...summaryForm, adults: event.target.value })}
                      />
                    </label>
                    <label>
                      Menores
                      <input
                        min="0"
                        type="number"
                        value={summaryForm.children}
                        onChange={(event) => setSummaryForm({ ...summaryForm, children: event.target.value })}
                      />
                    </label>
                    <label>
                      Tarifa noche
                      <input
                        min="0"
                        type="number"
                        value={summaryForm.nightlyRate}
                        onChange={(event) => setSummaryForm({ ...summaryForm, nightlyRate: event.target.value })}
                      />
                    </label>
                    <label>
                      Total estadia
                      <input
                        min="0"
                        type="number"
                        value={summaryForm.totalAmount}
                        onChange={(event) => setSummaryForm({ ...summaryForm, totalAmount: event.target.value })}
                      />
                    </label>
                    <label>
                      Origen
                      <select
                        value={summaryForm.source}
                        onChange={(event) => setSummaryForm({ ...summaryForm, source: event.target.value })}
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
                        value={summaryForm.notes}
                        onChange={(event) => setSummaryForm({ ...summaryForm, notes: event.target.value })}
                      />
                    </label>
                  </div>
                  <button className="primary-button" disabled={busyAction === "update"}>
                    <Save size={15} />
                    {busyAction === "update" ? "Guardando..." : "Guardar detalle"}
                  </button>
                </form>
              ) : null}
            </section>

            <section className="reservation-section-card" hidden={activeTab !== "guests"}>
              <div className="section-title-row">
                <div>
                  <span className="detail-kicker">Huespedes</span>
                  <h3>Rooming list y contacto</h3>
                </div>
                <span className={`status-pill ${isGuestReadOnly ? "" : roomingComplete ? "good" : "warn"}`}>
                  {isGuestReadOnly ? "Solo lectura" : `${completeOccupants}/${totalPax} completos`}
                </span>
              </div>

              <div className="reservation-fact-grid compact">
                <Fact
                  label="Pax"
                  value={`${reservation.adults} adultos / ${reservation.children} menores`}
                  hint={`${totalPax} persona${totalPax === 1 ? "" : "s"} esperada${totalPax === 1 ? "" : "s"}`}
                />
                <Fact label="Documentos" value={`${guestsWithDocument}/${totalPax}`} hint="Personas con documento" />
                <Fact label="Contacto" value={`${guestsWithContact}/${totalPax}`} hint="Telefono o email cargado" />
                <Fact label="Nacionalidad" value={`${guestsWithNationality}/${totalPax}`} hint="Dato migratorio" />
              </div>

              <div className="reservation-guest-list" role="table" aria-label="Lista de huespedes">
                <div className="reservation-guest-list-head" role="row">
                  <span>Huesped</span>
                  <span>Documento</span>
                  <span>Contacto</span>
                  <span>Nacionalidad</span>
                </div>
                {guestRows.map((guest, index) => (
                  <GuestRosterRow guest={guest} index={index} key={guest.key} />
                ))}
              </div>

              <div className="reservation-guest-actions">
                {isGuestReadOnly ? (
                  <div className="reservation-readonly-box">
                    <Ban size={16} />
                    <div>
                      <strong>Solo lectura</strong>
                      <span>La reserva esta {statusLabels[reservation.status] ?? reservation.status}; no permite modificar huespedes.</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="primary-button"
                      disabled={!canEditRooming || busyAction === "rooming"}
                      onClick={openRoomingPanel}
                      type="button"
                    >
                      <Users size={15} />
                      {roomingComplete ? "Editar huespedes" : "Completar rooming"}
                    </button>
                    <button
                      disabled={!canEditGuestContact || busyAction === "update"}
                      onClick={() => openPanel("guests", "guest")}
                      type="button"
                    >
                      <Pencil size={15} />
                      Editar contacto titular
                    </button>
                    {effectiveRoom && onOpenRoom ? (
                      <button onClick={() => onOpenRoom(effectiveRoom.id)} type="button">
                        <UserRound size={15} />
                        Abrir habitacion
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              {inlinePanel === "rooming" ? (
                <form className="reservation-rooming-form" onSubmit={submitRoomingUpdate}>
                  <div className="reservation-rooming-header">
                    <div>
                      <span className="detail-kicker">Edicion de rooming</span>
                      <h4>Huespedes de la estadia</h4>
                    </div>
                    <button type="button" onClick={() => setInlinePanel(null)}>
                      <X size={15} />
                      Cancelar
                    </button>
                  </div>
                  <div className="form-grid two">
                    <label>
                      Adultos
                      <input
                        min="1"
                        required
                        type="number"
                        value={roomingForm.adults}
                        onChange={(event) => updateRoomingCount("adults", event.target.value)}
                      />
                    </label>
                    <label>
                      Menores
                      <input
                        min="0"
                        type="number"
                        value={roomingForm.children}
                        onChange={(event) => updateRoomingCount("children", event.target.value)}
                      />
                    </label>
                  </div>
                  {roomingError ? <div className="reservation-form-error">{roomingError}</div> : null}
                  <div className="reservation-rooming-editor">
                    {roomingForm.occupants.map((occupant, index) => (
                      <section
                        className={`reservation-rooming-card ${activeGuestPanel === index ? "active" : ""}`}
                        key={`${occupant.ageCategory}-${index}`}
                      >
                        <button
                          className="reservation-rooming-card-header"
                          type="button"
                          onClick={() => setActiveGuestPanel((current) => (current === index ? null : index))}
                        >
                          <span>
                            <strong>{occupant.primary ? "Titular" : `Huesped ${index + 1}`}</strong>
                            <small>
                              {occupant.firstName || occupant.lastName
                                ? `${occupant.lastName}, ${occupant.firstName}`
                                : "Datos pendientes"}
                            </small>
                          </span>
                          <i>{occupant.ageCategory === "child" ? "Menor" : "Adulto"}</i>
                        </button>
                        {activeGuestPanel === index ? (
                          <div className="reservation-rooming-fields">
                            <div className="form-grid two">
                              <label>
                                Nombre
                                <input
                                  required
                                  value={occupant.firstName}
                                  onChange={(event) => updateRoomingOccupant(index, { firstName: event.target.value })}
                                />
                              </label>
                              <label>
                                Apellido
                                <input
                                  required
                                  value={occupant.lastName}
                                  onChange={(event) => updateRoomingOccupant(index, { lastName: event.target.value })}
                                />
                              </label>
                              <label>
                                Tipo doc.
                                <input
                                  value={occupant.documentType}
                                  onChange={(event) => updateRoomingOccupant(index, { documentType: event.target.value })}
                                />
                              </label>
                              <label>
                                Documento
                                <input
                                  value={occupant.documentNumber}
                                  onChange={(event) => updateRoomingOccupant(index, { documentNumber: event.target.value })}
                                />
                              </label>
                              <label>
                                Telefono
                                <input
                                  value={occupant.phone}
                                  onChange={(event) => updateRoomingOccupant(index, { phone: event.target.value })}
                                />
                              </label>
                              <label>
                                Nacionalidad
                                <input
                                  value={occupant.nationality}
                                  onChange={(event) => updateRoomingOccupant(index, { nationality: event.target.value })}
                                />
                              </label>
                              <label>
                                Tipo de huesped
                                <select
                                  value={occupant.ageCategory}
                                  onChange={(event) =>
                                    updateRoomingOccupantAge(
                                      index,
                                      event.target.value === "child" ? "child" : "adult",
                                    )
                                  }
                                >
                                  <option value="adult">Adulto</option>
                                  <option value="child">Menor</option>
                                </select>
                              </label>
                              <label className="checkbox-line rooming-primary-line">
                                <input
                                  type="radio"
                                  name="reservation-primary-guest"
                                  checked={occupant.primary}
                                  onChange={() => markRoomingPrimary(index)}
                                />
                                Titular de la reserva
                              </label>
                            </div>
                            <div className="document-scan-inline">
                              <div>
                                <span>
                                  <ScanLine size={16} />
                                  DNI remoto
                                </span>
                                <p>
                                  Desde el celular logueado con tu usuario entra a{" "}
                                  <strong>/document-scanner</strong> y escanea el PDF417 o envia foto.
                                </p>
                              </div>
                              <button
                                className="secondary-button"
                                disabled={
                                  !canEditRooming ||
                                  documentScanRequest?.status === "waiting" ||
                                  busyAction === "rooming"
                                }
                                type="button"
                                onClick={() => startDocumentScan(index)}
                              >
                                <Smartphone size={16} />
                                {documentScanRequest?.status === "waiting" &&
                                documentScanRequest.occupantIndex === index
                                  ? "Esperando celular..."
                                  : "Escanear con celular"}
                              </button>
                            </div>
                            {documentScanRequest?.status === "waiting" &&
                            documentScanRequest.occupantIndex === index ? (
                              <div className="document-scan-status">
                                <span className="status-pill warn">Esperando</span>
                                <p>
                                  Pedido activo para {documentScanRequest.occupantLabel || `Huesped ${index + 1}`}.
                                  Vence a las{" "}
                                  {new Date(documentScanRequest.expiresAt).toLocaleTimeString("es-AR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  .
                                </p>
                              </div>
                            ) : null}
                            {documentScanMessage && activeGuestPanel === index ? (
                              <div className="document-scan-status">
                                <span className="status-pill good">Scanner</span>
                                <p>{documentScanMessage}</p>
                              </div>
                            ) : null}
                            {documentScanImage && activeGuestPanel === index ? (
                              <div className="document-scan-preview">
                                <img alt="DNI recibido desde celular" src={documentScanImage} />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    ))}
                  </div>
                  <div className="reservation-form-footer">
                    <button type="button" onClick={() => setInlinePanel(null)}>
                      Cancelar
                    </button>
                    <button className="primary-button" disabled={busyAction === "rooming"}>
                      <Save size={15} />
                      {busyAction === "rooming" ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              ) : null}

              {inlinePanel === "guest" ? (
                <form className="reservation-contact-form" onSubmit={submitGuestUpdate}>
                  <div className="reservation-rooming-header">
                    <div>
                      <span className="detail-kicker">Titular</span>
                      <h4>Contacto y datos principales</h4>
                    </div>
                    <button type="button" onClick={() => setInlinePanel(null)}>
                      <X size={15} />
                      Cancelar
                    </button>
                  </div>
                  <div className="form-grid two">
                    <label>
                      Nombre
                      <input
                        required
                        value={guestForm.firstName}
                        onChange={(event) => setGuestForm({ ...guestForm, firstName: event.target.value })}
                      />
                    </label>
                    <label>
                      Apellido
                      <input
                        required
                        value={guestForm.lastName}
                        onChange={(event) => setGuestForm({ ...guestForm, lastName: event.target.value })}
                      />
                    </label>
                    <label>
                      Tipo doc.
                      <input
                        value={guestForm.documentType}
                        onChange={(event) => setGuestForm({ ...guestForm, documentType: event.target.value })}
                      />
                    </label>
                    <label>
                      Documento
                      <input
                        value={guestForm.documentNumber}
                        onChange={(event) => setGuestForm({ ...guestForm, documentNumber: event.target.value })}
                      />
                    </label>
                    <label>
                      Telefono
                      <input
                        value={guestForm.phone}
                        onChange={(event) => setGuestForm({ ...guestForm, phone: event.target.value })}
                      />
                    </label>
                    <label>
                      Nacionalidad
                      <input
                        value={guestForm.nationality}
                        onChange={(event) => setGuestForm({ ...guestForm, nationality: event.target.value })}
                      />
                    </label>
                    <label className="wide">
                      Email
                      <input
                        type="email"
                        value={guestForm.email}
                        onChange={(event) => setGuestForm({ ...guestForm, email: event.target.value })}
                      />
                    </label>
                    <label className="wide">
                      Notas
                      <input
                        value={guestForm.notes}
                        onChange={(event) => setGuestForm({ ...guestForm, notes: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="reservation-form-footer">
                    <button type="button" onClick={() => setInlinePanel(null)}>
                      Cancelar
                    </button>
                    <button className="primary-button" disabled={busyAction === "update"}>
                      <Save size={15} />
                      {busyAction === "update" ? "Guardando..." : "Guardar contacto"}
                    </button>
                  </div>
                </form>
              ) : null}
            </section>

            <section className="reservation-section-card" hidden={activeTab !== "account"}>
              <div className="section-title-row">
                <div>
                  <span className="detail-kicker">Cuenta y pagos</span>
                  <h3>Saldo, sena y comprobantes</h3>
                </div>
                <span className={`status-pill ${folio.balance > 0 ? "warn" : "good"}`}>
                  {folio.balance > 0 ? "Saldo pendiente" : "Sin saldo"}
                </span>
              </div>
              <div className="reservation-money-strip">
                <MoneyStat label="Cargos" value={folio.chargesTotal} currency={reservation.currency} />
                <MoneyStat label="Pagos" value={folio.paymentsTotal} currency={reservation.currency} />
                <MoneyStat label="Saldo" value={folio.balance} currency={reservation.currency} strong />
                <MoneyStat label="Sena" value={toNumber(reservation.depositAmount)} currency={reservation.currency} />
              </div>
              <div className="reservation-payment-state">
                <div>
                  <span>Sena</span>
                  <strong>{toNumber(reservation.depositAmount) > 0 ? (reservation.depositPaid ? "Pagada" : "Pendiente") : "Sin sena"}</strong>
                  <small>
                    {reservation.depositPaid && reservation.depositMethod
                      ? `${paymentMethodLabels[reservation.depositMethod]} ${reservation.depositReference ?? ""}`
                      : "Se puede registrar como pago de caja si corresponde."}
                  </small>
                </div>
                <div>
                  <span>Comprobante</span>
                  <strong>
                    {latestInvoice
                      ? `${invoiceTypeLabels[latestInvoice.type]} - ${invoiceStatusLabels[latestInvoice.status]}`
                      : "Sin comprobante"}
                  </strong>
                  <small>{latestInvoice?.number ? `Nro. ${latestInvoice.number}` : "Pendiente de facturacion si el folio ya esta listo."}</small>
                </div>
              </div>
              <CompactLedger folio={reservation.folio} currency={reservation.currency} />
              <ReservationActionPanel
                title="Datos que se pueden modificar"
                items={[
                  "Sena, medio y referencia antes del check-in",
                  "Cargos y pagos desde la cuenta de la habitacion",
                  "Factura, NC/ND y anulaciones solo con permisos",
                ]}
              />
              <div className="reservation-edit-toolbar">
                <button
                  disabled={!canEditReservation || busyAction === "update"}
                  onClick={() => openPanel("account", "deposit")}
                  type="button"
                >
                  <Pencil size={15} />
                  Editar sena
                </button>
                {effectiveRoom && onOpenRoom ? (
                  <button onClick={() => onOpenRoom(effectiveRoom.id)} type="button">
                    <Wallet size={15} />
                    Abrir cuenta
                  </button>
                ) : null}
              </div>
              {inlinePanel === "deposit" ? (
                <form className="reservation-inline-form" onSubmit={submitDepositUpdate}>
                  <div className="form-grid two">
                    <label>
                      Sena
                      <input
                        min="0"
                        type="number"
                        value={depositForm.depositAmount}
                        onChange={(event) =>
                          setDepositForm({
                            ...depositForm,
                            depositAmount: event.target.value,
                            depositPaid: Number(event.target.value || 0) > 0 ? depositForm.depositPaid : false,
                          })
                        }
                      />
                    </label>
                    <label>
                      Medio
                      <select
                        disabled={!depositForm.depositPaid || Number(depositForm.depositAmount || 0) <= 0}
                        value={depositForm.depositMethod}
                        onChange={(event) =>
                          setDepositForm({ ...depositForm, depositMethod: event.target.value as PaymentMethod })
                        }
                      >
                        {paymentMethods.map((method) => (
                          <option value={method} key={method}>
                            {paymentMethodLabels[method]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="checkbox-line wide">
                      <input
                        type="checkbox"
                        checked={depositForm.depositPaid}
                        disabled={Number(depositForm.depositAmount || 0) <= 0}
                        onChange={(event) => setDepositForm({ ...depositForm, depositPaid: event.target.checked })}
                      />
                      Sena pagada
                    </label>
                    <label className="wide">
                      Referencia
                      <input
                        disabled={!depositForm.depositPaid || Number(depositForm.depositAmount || 0) <= 0}
                        value={depositForm.depositReference}
                        onChange={(event) => setDepositForm({ ...depositForm, depositReference: event.target.value })}
                      />
                    </label>
                  </div>
                  <button className="primary-button" disabled={busyAction === "update"}>
                    <Save size={15} />
                    {busyAction === "update" ? "Guardando..." : "Guardar sena"}
                  </button>
                </form>
              ) : null}
            </section>

            <section className="reservation-section-card" hidden={activeTab !== "calendar"}>
              <div className="section-title-row">
                <div>
                  <span className="detail-kicker">Calendario</span>
                  <h3>Estadia y disponibilidad</h3>
                </div>
                {onOpenCalendar ? (
                  <button onClick={() => onOpenCalendar(reservation)} type="button">
                    <CalendarDays size={15} />
                    Abrir calendario
                  </button>
                ) : null}
              </div>
              <div className="reservation-calendar-overview">
                <div>
                  <span>Entrada</span>
                  <strong>{formatStayEndpoint(reservation.checkInDate, DEFAULT_CHECK_IN_TIME)}</strong>
                </div>
                <div>
                  <span>Salida</span>
                  <strong>{formatStayEndpoint(reservation.checkOutDate, DEFAULT_CHECK_OUT_TIME)}</strong>
                </div>
                <div>
                  <span>Habitacion</span>
                  <strong>{effectiveRoom ? `Hab. ${effectiveRoom.number}` : "Sin asignar"}</strong>
                </div>
                <div>
                  <span>Noches</span>
                  <strong>{stay.nights}</strong>
                </div>
              </div>
              <div className="reservation-mini-calendar" aria-label="Linea de estadia">
                {stayPreviewDays(reservation).map((day) => (
                  <div className={day.kind} key={day.date}>
                    <span>{day.label}</span>
                    <strong>{day.value}</strong>
                    <small>{day.caption}</small>
                  </div>
                ))}
              </div>
              <ReservationActionPanel
                title="Que se modifica desde calendario"
                items={[
                  "Mover la reserva de fecha si aun no esta alojada",
                  "Mover a otra habitacion compatible si hay disponibilidad",
                  "Crear una reserva nueva en un hueco libre de la misma habitacion",
                ]}
              />
            </section>
          </main>

          <aside className="reservation-detail-side">
            <section className="reservation-section-card" hidden={activeTab !== "operation"}>
              <div className="section-title-row">
                <div>
                  <span className="detail-kicker">Operacion</span>
                  <h3>Estado de la habitacion</h3>
                </div>
              </div>
              <div className="reservation-state-list">
                <StateLine icon={<Home size={16} />} label="Venta" value={effectiveRoom?.commercialStatus ?? "Sin dato"} />
                <StateLine icon={<Sparkles size={16} />} label="Limpieza" value={effectiveRoom?.cleaningStatus ?? "Sin dato"} />
                <StateLine icon={<Wrench size={16} />} label="Mantenimiento" value={effectiveRoom?.maintenanceStatus ?? "Sin dato"} />
                <StateLine icon={<CalendarClock size={16} />} label="Momento" value={stay.relativeLabel} />
              </div>
              {effectiveRoom && onOpenRoom ? (
                <button className="secondary-button wide-action" onClick={() => onOpenRoom(effectiveRoom.id)} type="button">
                  <Home size={16} />
                  Abrir habitacion
                </button>
              ) : null}
            </section>

            <section className="reservation-section-card" hidden={activeTab !== "operation"}>
              <div className="section-title-row">
                <div>
                  <span className="detail-kicker">Acciones</span>
                  <h3>Segun estado</h3>
                </div>
              </div>
              <div className="reservation-action-list">
                {onOpenCalendar ? (
                  <button onClick={() => onOpenCalendar(reservation)} type="button">
                    <CalendarDays size={16} />
                    Calendario de reserva
                  </button>
                ) : null}
                {reservation.status === "pending" && onConfirm ? (
                  <button disabled={!canUpdate || busyAction === "confirm"} onClick={() => onConfirm(reservation)} type="button">
                    <CheckCircle2 size={16} />
                    Confirmar
                  </button>
                ) : null}
                {["pending", "confirmed", "assigned"].includes(reservation.status) && onCancel ? (
                  <button disabled={!canUpdate || busyAction === "cancel"} onClick={() => onCancel(reservation)} type="button">
                    <Ban size={16} />
                    Cancelar
                  </button>
                ) : null}
                {["confirmed", "assigned"].includes(reservation.status) && onCheckIn ? (
                  <button disabled={!canCheckIn || busyAction === "check-in"} onClick={() => onCheckIn(reservation)} type="button">
                    <DoorOpen size={16} />
                    Check-in
                  </button>
                ) : null}
                {reservation.status === "in_house" && onCheckOut ? (
                  <button disabled={!canCheckOut || busyAction === "check-out" || folio.balance > 0} onClick={() => onCheckOut(reservation)} type="button">
                    <DoorOpen size={16} />
                    Check-out
                  </button>
                ) : null}
                {onOpenReservations ? (
                  <button onClick={onOpenReservations} type="button">
                    <ArrowRightLeft size={16} />
                    Ir al buscador
                  </button>
                ) : null}
              </div>
              <ReservationActionPanel
                title="Operaciones seguras"
                items={[
                  "Check-in solo con rooming completo y habitacion lista",
                  "Check-out solo sin saldo pendiente",
                  "Cambios de habitacion bloquean solapamientos y estados fuera de servicio",
                ]}
              />
            </section>

            <section className="reservation-section-card" hidden={activeTab !== "history"}>
              <div className="section-title-row">
                <div>
                  <span className="detail-kicker">Historial</span>
                  <h3>Linea operativa</h3>
                </div>
              </div>
              <div className="reservation-timeline">
                {timelineItems(reservation, folio).map((item) => (
                  <div key={`${item.label}-${item.value}`}>
                    {item.icon}
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              <ReservationActionPanel
                title="Solo lectura"
                items={[
                  "Cambios de reserva, habitacion, rooming, cargos y pagos",
                  "Usuarios, fechas y motivos cuando el backend lo registre",
                  "Anulaciones y recuperos deben hacerse por flujos con permiso",
                ]}
              />
            </section>
          </aside>
        </div>
      </aside>
    </>
  );
}

function ReservationActionPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="reservation-capability-panel">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="reservation-fact">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function GuestRosterRow({ guest, index }: { guest: ReservationGuestRow; index: number }) {
  const displayName = guest.pending
    ? `Huesped ${index + 1} pendiente`
    : `${guest.lastName}, ${guest.firstName}`;
  const role = guest.primary ? "Titular" : guest.ageCategory === "child" ? "Menor" : "Adulto";
  const documentLabel = guest.documentNumber
    ? `${guest.documentType ?? "Doc."} ${guest.documentNumber}`
    : "Documento pendiente";
  const phoneLabel = guest.phone?.trim() || "Telefono pendiente";
  const emailLabel = guest.email?.trim() || "Email pendiente";
  const nationalityLabel = guest.nationality?.trim() || "Nacionalidad pendiente";

  return (
    <article className={`reservation-guest-row ${guest.pending ? "pending" : ""}`} role="row">
      <div className="reservation-guest-main" role="cell">
        <div>
          <span className="reservation-guest-index">#{index + 1}</span>
          <strong>{displayName}</strong>
        </div>
        <span className={`status-pill ${guest.pending ? "warn" : guest.documentNumber ? "good" : "warn"}`}>
          {guest.pending ? "Falta cargar" : role}
        </span>
      </div>
      <div className="reservation-guest-cell" role="cell">
        <span>Documento</span>
        <strong>{documentLabel}</strong>
      </div>
      <div className="reservation-guest-cell" role="cell">
        <span>Contacto</span>
        <strong>{phoneLabel}</strong>
        <small>{emailLabel}</small>
      </div>
      <div className="reservation-guest-cell" role="cell">
        <span>Nacionalidad</span>
        <strong>{nationalityLabel}</strong>
        {guest.notes ? <small>{guest.notes}</small> : null}
      </div>
    </article>
  );
}

function MoneyStat({ label, value, currency, strong }: { label: string; value: number; currency: string; strong?: boolean }) {
  return (
    <div className={strong ? "strong" : ""}>
      <span>{label}</span>
      <strong>{formatMoney(value, currency)}</strong>
    </div>
  );
}

function StateLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="reservation-state-line">
      {icon}
      <span>{label}</span>
      <strong>{statusLabels[value] ?? value}</strong>
    </div>
  );
}

function CompactLedger({ folio, currency }: { folio?: ReservationFolio | null; currency: string }) {
  const charges = folio?.charges ?? [];
  const payments = folio?.payments ?? [];

  if (!folio) {
    return (
      <div className="reservation-empty-block">
        <strong>Sin folio abierto</strong>
        <span>La cuenta se abre automaticamente al hacer check-in.</span>
      </div>
    );
  }

  return (
    <div className="reservation-ledger">
      <div>
        <span>
          <ReceiptText size={15} />
          Ultimos cargos
        </span>
        {charges.slice(-3).map((charge) => (
          <div className="reservation-ledger-row" key={charge.id}>
            <strong>{chargeKindLabels[charge.kind]}</strong>
            <small>{charge.description}</small>
            <em>{formatMoney(toNumber(charge.totalAmount), currency)}</em>
          </div>
        ))}
        {!charges.length ? <small>Sin cargos.</small> : null}
      </div>
      <div>
        <span>
          <Wallet size={15} />
          Ultimos pagos
        </span>
        {payments.slice(-3).map((payment) => (
          <div className="reservation-ledger-row" key={payment.id}>
            <strong>{paymentMethodLabels[payment.method]}</strong>
            <small>{payment.reference || formatDateTime(payment.paidAt)}</small>
            <em>{formatMoney(toNumber(payment.amount), payment.currency)}</em>
          </div>
        ))}
        {!payments.length ? <small>Sin pagos.</small> : null}
      </div>
    </div>
  );
}

function stayFacts(reservation: OperationalReservation) {
  const checkIn = parseDateOnly(reservation.checkInDate);
  const checkOut = parseDateOnly(reservation.checkOutDate);
  const today = startOfDay(new Date());
  const nights = Math.max(1, diffDays(checkIn, checkOut));
  const daysToArrival = diffDays(today, checkIn);
  const daysToDeparture = diffDays(today, checkOut);
  const arrivalToday = daysToArrival === 0;
  const departureToday = daysToDeparture === 0;
  const inStayWindow = today >= checkIn && today < checkOut;

  let relativeLabel = "Futura";
  if (reservation.status === "completed") relativeLabel = "Finalizada";
  else if (reservation.status === "cancelled" || reservation.status === "no_show") relativeLabel = "Cerrada";
  else if (arrivalToday) relativeLabel = "Llega hoy";
  else if (departureToday) relativeLabel = "Sale hoy";
  else if (inStayWindow) relativeLabel = "En estadia";
  else if (daysToArrival > 0) relativeLabel = `Llega en ${daysToArrival} dia(s)`;
  else if (daysToDeparture < 0) relativeLabel = "Salida vencida";

  return { checkIn, checkOut, nights, daysToArrival, daysToDeparture, arrivalToday, departureToday, inStayWindow, relativeLabel };
}

function folioFacts(reservation: OperationalReservation) {
  const charges = reservation.folio?.charges ?? [];
  const payments = reservation.folio?.payments ?? [];
  const chargesTotal = charges.reduce((sum, charge) => sum + toNumber(charge.totalAmount), 0);
  const paymentsTotal = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const balance = Math.max(0, chargesTotal - paymentsTotal);
  return {
    charges,
    payments,
    invoices: reservation.folio?.invoices ?? [],
    chargesTotal,
    paymentsTotal,
    balance,
  };
}

function reservationFlow(
  reservation: OperationalReservation,
  room: ReservationDrawerRoom | null,
  stay: ReturnType<typeof stayFacts>,
  folio: ReturnType<typeof folioFacts>,
) {
  const roomingComplete = countCompleteOccupants(reservation.occupants ?? []) >= reservation.adults + reservation.children;
  const roomReady = isRoomReadyForCheckIn(room);

  if (reservation.status === "pending") {
    return {
      kind: "confirm",
      tone: "warn",
      title: "Reserva pendiente de confirmacion",
      description: "Revisar datos, sena y asignacion antes de bloquear la disponibilidad como confirmada.",
    } as const;
  }
  if (["confirmed", "assigned"].includes(reservation.status) && !roomingComplete) {
    return {
      kind: "rooming",
      tone: stay.arrivalToday ? "warn" : "neutral",
      title: stay.arrivalToday ? "Llegada hoy: completar huespedes" : "Completar rooming list",
      description: "Antes del check-in deben estar cargadas todas las personas de la habitacion.",
    } as const;
  }
  if (["confirmed", "assigned"].includes(reservation.status) && !roomReady) {
    return {
      kind: "room_not_ready",
      tone: "bad",
      title: "Habitacion no lista para ingresar",
      description: "Resolver limpieza, mantenimiento o disponibilidad antes de hacer check-in.",
    } as const;
  }
  if (["confirmed", "assigned"].includes(reservation.status)) {
    return {
      kind: "check_in",
      tone: stay.arrivalToday ? "good" : "neutral",
      title: stay.arrivalToday ? "Llegada lista para check-in" : "Reserva preparada",
      description: "La reserva ya tiene datos minimos y habitacion operativa para avanzar cuando llegue el huesped.",
    } as const;
  }
  if (reservation.status === "in_house" && stay.departureToday && folio.balance > 0) {
    return {
      kind: "collect",
      tone: "warn",
      title: "Salida hoy con saldo pendiente",
      description: "Registrar pagos y preparar comprobante antes de cerrar la estadia.",
    } as const;
  }
  if (reservation.status === "in_house" && stay.departureToday) {
    return {
      kind: "check_out",
      tone: "good",
      title: "Lista para check-out",
      description: "La cuenta no tiene saldo pendiente. Verificar factura y confirmar salida.",
    } as const;
  }
  if (reservation.status === "in_house") {
    return {
      kind: "in_house",
      tone: "neutral",
      title: "Estadia en curso",
      description: "Gestionar cargos, pagos, cambios de habitacion y necesidades del huesped desde la habitacion.",
    } as const;
  }
  if (reservation.status === "completed") {
    return {
      kind: "completed",
      tone: "neutral",
      title: "Estadia finalizada",
      description: "Consultar pagos, comprobantes e historial. Las acciones operativas ya quedaron cerradas.",
    } as const;
  }
  return {
    kind: "closed",
    tone: "bad",
    title: reservation.status === "no_show" ? "No-show registrado" : "Reserva cancelada",
    description: "No hay flujo operativo activo. Revisar motivo, auditoria y movimientos asociados.",
  } as const;
}

function reservationAlerts(
  reservation: OperationalReservation,
  room: ReservationDrawerRoom | null,
  stay: ReturnType<typeof stayFacts>,
  folio: ReturnType<typeof folioFacts>,
) {
  const alerts: { title: string; description: string; tone: string; icon: ReactNode }[] = [];
  const roomingComplete = countCompleteOccupants(reservation.occupants ?? []) >= reservation.adults + reservation.children;
  const depositAmount = toNumber(reservation.depositAmount);

  if (stay.arrivalToday && ["confirmed", "assigned"].includes(reservation.status)) {
    alerts.push({ title: "Llega hoy", description: "Prioridad para recepcion y housekeeping.", tone: "good", icon: <DoorOpen size={17} /> });
  }
  if (stay.departureToday && reservation.status === "in_house") {
    alerts.push({ title: "Sale hoy", description: "Revisar saldo, factura y check-out.", tone: "warn", icon: <CalendarClock size={17} /> });
  }
  if (!reservation.assignedRoom) {
    alerts.push({ title: "Sin habitacion", description: "Asignar habitacion antes de operar check-in.", tone: "warn", icon: <Home size={17} /> });
  }
  if (!roomingComplete && ["confirmed", "assigned"].includes(reservation.status)) {
    alerts.push({ title: "Rooming incompleto", description: "Faltan datos de una o mas personas.", tone: "warn", icon: <UserRound size={17} /> });
  }
  if (room && !isRoomReadyForCheckIn(room) && ["confirmed", "assigned"].includes(reservation.status)) {
    alerts.push({ title: "Habitacion bloqueante", description: "No esta disponible, limpia u OK de mantenimiento.", tone: "bad", icon: <AlertTriangle size={17} /> });
  }
  if (depositAmount > 0 && !reservation.depositPaid && ["pending", "confirmed", "assigned"].includes(reservation.status)) {
    alerts.push({ title: "Sena pendiente", description: `${formatMoney(depositAmount, reservation.currency)} sin marcar como cobrada.`, tone: "warn", icon: <CreditCard size={17} /> });
  }
  if (folio.balance > 0 && reservation.status === "in_house") {
    alerts.push({ title: "Saldo pendiente", description: `${formatMoney(folio.balance, reservation.currency)} por cobrar.`, tone: "warn", icon: <Wallet size={17} /> });
  }
  if (reservation.status === "in_house" && stay.departureToday && !folio.invoices.length) {
    alerts.push({ title: "Factura pendiente", description: "No hay comprobante asociado al folio.", tone: "warn", icon: <ReceiptText size={17} /> });
  }

  return alerts;
}

function buildPrimaryAction({
  reservation,
  room,
  flowKind,
  canUpdate,
  canCheckIn,
  canCheckOut,
  canCreateInvoice,
  onOpenRoom,
  onConfirm,
  onCheckIn,
  onCheckOut,
}: {
  reservation: OperationalReservation;
  room: ReservationDrawerRoom | null;
  flowKind: string;
  canUpdate: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  canCreateInvoice: boolean;
  onOpenRoom?: (roomId: string) => void;
  onConfirm?: (reservation: OperationalReservation) => void | Promise<void>;
  onCheckIn?: (reservation: OperationalReservation) => void | Promise<void>;
  onCheckOut?: (reservation: OperationalReservation) => void | Promise<void>;
}) {
  if (flowKind === "confirm" && onConfirm) {
    return { key: "confirm", label: "Confirmar reserva", icon: <CheckCircle2 size={16} />, disabled: !canUpdate, onClick: () => onConfirm(reservation) };
  }
  if ((flowKind === "rooming" || flowKind === "room_not_ready" || flowKind === "collect" || flowKind === "in_house") && room && onOpenRoom) {
    return { key: "open-room", label: flowKind === "collect" ? "Abrir pagos" : "Abrir habitacion", icon: <Home size={16} />, disabled: false, onClick: () => onOpenRoom(room.id) };
  }
  if (flowKind === "check_in" && onCheckIn) {
    return { key: "check-in", label: "Hacer check-in", icon: <DoorOpen size={16} />, disabled: !canCheckIn, onClick: () => onCheckIn(reservation) };
  }
  if (flowKind === "check_out" && onCheckOut) {
    return { key: "check-out", label: "Hacer check-out", icon: <DoorOpen size={16} />, disabled: !canCheckOut, onClick: () => onCheckOut(reservation) };
  }
  if (flowKind === "check_out" && !canCreateInvoice) {
    return { key: "invoice", label: "Revisar factura", icon: <ReceiptText size={16} />, disabled: true, onClick: () => undefined };
  }
  return null;
}

function timelineItems(reservation: OperationalReservation, folio: ReturnType<typeof folioFacts>) {
  const items = [
    {
      icon: <CalendarClock size={15} />,
      label: "Reserva creada",
      value: reservation.createdAt ? formatDateTime(reservation.createdAt) : reservation.code,
    },
  ];
  if (reservation.stay?.checkedInAt) {
    items.push({ icon: <DoorOpen size={15} />, label: "Check-in", value: formatDateTime(reservation.stay.checkedInAt) });
  }
  if (reservation.folio?.openedAt) {
    items.push({ icon: <Wallet size={15} />, label: "Folio abierto", value: formatDateTime(reservation.folio.openedAt) });
  }
  if (folio.charges.length) {
    items.push({ icon: <ReceiptText size={15} />, label: "Cargos", value: `${folio.charges.length} movimiento(s)` });
  }
  if (folio.payments.length) {
    items.push({ icon: <CreditCard size={15} />, label: "Pagos", value: `${folio.payments.length} pago(s)` });
  }
  if (folio.invoices.length) {
    const invoice = folio.invoices[0];
    items.push({ icon: <FileText size={15} />, label: "Ultimo comprobante", value: invoiceStatusLabels[invoice.status] ?? invoice.status });
  }
  if (reservation.stay?.checkedOutAt) {
    items.push({ icon: <CheckCircle2 size={15} />, label: "Check-out", value: formatDateTime(reservation.stay.checkedOutAt) });
  }
  if (items.length === 1) {
    items.push({ icon: <History size={15} />, label: "Sin mas movimientos", value: "Todavia no hay operacion registrada." });
  }
  return items;
}

function isRoomReadyForCheckIn(room: ReservationDrawerRoom | null) {
  if (!room) return false;
  return room.commercialStatus === "available" && room.cleaningStatus === "clean" && room.maintenanceStatus === "ok";
}

function countCompleteOccupants(occupants: ReservationOccupant[]) {
  return occupants.filter((occupant) => occupant.firstName?.trim() && occupant.lastName?.trim()).length;
}

function buildReservationGuestRows(reservation: OperationalReservation): ReservationGuestRow[] {
  const totalPax = reservation.adults + reservation.children;
  const occupantRows =
    reservation.occupants?.map((occupant, index) => ({
      key: occupant.id ?? `occupant-${index}`,
      firstName: occupant.firstName,
      lastName: occupant.lastName,
      documentType: occupant.documentType,
      documentNumber: occupant.documentNumber,
      email: occupant.primary ? reservation.guest.email : null,
      phone: occupant.phone,
      nationality: occupant.nationality,
      notes: occupant.primary ? reservation.guest.notes : null,
      ageCategory: occupant.ageCategory,
      primary: occupant.primary,
      pending: false,
    })) ?? [];

  const baseRows: ReservationGuestRow[] =
    occupantRows.length > 0
      ? occupantRows
      : [
          {
            key: "guest-primary",
            firstName: reservation.guest.firstName,
            lastName: reservation.guest.lastName,
            documentType: reservation.guest.documentType,
            documentNumber: reservation.guest.documentNumber,
            email: reservation.guest.email,
            phone: reservation.guest.phone,
            nationality: reservation.guest.nationality,
            notes: reservation.guest.notes,
            ageCategory: "adult",
            primary: true,
            pending: false,
          },
        ];

  const rows: ReservationGuestRow[] = [...baseRows];
  const missingRows = Math.max(totalPax - rows.length, 0);

  for (let index = 0; index < missingRows; index += 1) {
    const currentAdults = rows.filter((guest) => guest.ageCategory === "adult").length;
    const currentChildren = rows.filter((guest) => guest.ageCategory === "child").length;
    const ageCategory: "adult" | "child" =
      currentAdults < reservation.adults || currentChildren >= reservation.children ? "adult" : "child";

    rows.push({
      key: `pending-${index}`,
      firstName: "",
      lastName: "",
      documentType: null,
      documentNumber: null,
      email: null,
      phone: null,
      nationality: null,
      notes: null,
      ageCategory,
      primary: false,
      pending: true,
    });
  }

  return rows;
}

function sourceLabel(source?: string | null) {
  const labels: Record<string, string> = {
    direct: "Directa",
    phone: "Telefono",
    online_csv: "Online importada",
    walk_in: "Walk-in",
  };
  return source ? labels[source] ?? source : "Sin origen";
}

function parseDateOnly(value: string) {
  return startOfDay(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000);
}

function formatStayEndpoint(value: string, time: string) {
  return `${formatDate(value)} ${time}`;
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function formatMoney(value: number, currency = "ARS") {
  if (!value) return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(0);
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

function nullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSummaryForm(reservation: OperationalReservation): ReservationSummaryForm {
  return {
    checkInDate: reservation.checkInDate.slice(0, 10),
    checkOutDate: reservation.checkOutDate.slice(0, 10),
    adults: String(reservation.adults),
    children: String(reservation.children),
    nightlyRate: toNumber(reservation.nightlyRate) ? String(toNumber(reservation.nightlyRate)) : "",
    totalAmount: toNumber(reservation.totalAmount) ? String(toNumber(reservation.totalAmount)) : "",
    source: reservation.source ?? "direct",
    notes: reservation.notes ?? "",
  };
}

function buildGuestForm(reservation: OperationalReservation): ReservationGuestForm {
  return {
    firstName: reservation.guest.firstName,
    lastName: reservation.guest.lastName,
    documentType: reservation.guest.documentType ?? "",
    documentNumber: reservation.guest.documentNumber ?? "",
    email: reservation.guest.email ?? "",
    phone: reservation.guest.phone ?? "",
    nationality: reservation.guest.nationality ?? "",
    notes: reservation.guest.notes ?? "",
  };
}

function buildRoomingForm(reservation: OperationalReservation): RoomingForm {
  const rows = buildReservationGuestRows(reservation);
  return resizeRoomingForm({
    adults: String(reservation.adults),
    children: String(reservation.children),
    occupants: rows.map((guest) => ({
      firstName: guest.firstName,
      lastName: guest.lastName,
      documentType: guest.documentType ?? "DNI",
      documentNumber: guest.documentNumber ?? "",
      phone: guest.phone ?? "",
      nationality: guest.nationality ?? "",
      ageCategory: guest.ageCategory,
      primary: guest.primary,
    })),
  });
}

function resizeRoomingForm(form: RoomingForm): RoomingForm {
  const adults = Math.max(1, Number.parseInt(form.adults, 10) || 1);
  const children = Math.max(0, Number.parseInt(form.children, 10) || 0);
  const adultOccupants = form.occupants.filter((occupant) => occupant.ageCategory === "adult");
  const childOccupants = form.occupants.filter((occupant) => occupant.ageCategory === "child");

  while (adultOccupants.length < adults) {
    adultOccupants.push(emptyRoomingOccupant("adult", adultOccupants.length === 0));
  }
  while (childOccupants.length < children) {
    childOccupants.push(emptyRoomingOccupant("child", false));
  }

  const occupants = [...adultOccupants.slice(0, adults), ...childOccupants.slice(0, children)];
  const primaryIndex = occupants.findIndex((occupant) => occupant.primary);
  return {
    adults: String(adults),
    children: String(children),
    occupants: occupants.map((occupant, index) => ({
      ...occupant,
      primary: primaryIndex >= 0 ? index === primaryIndex : index === 0,
    })),
  };
}

function emptyRoomingOccupant(ageCategory: RoomingOccupantForm["ageCategory"], primary: boolean): RoomingOccupantForm {
  return {
    firstName: "",
    lastName: "",
    documentType: "DNI",
    documentNumber: "",
    phone: "",
    nationality: "",
    ageCategory,
    primary,
  };
}

function normalizeRoomingOccupants(occupants: RoomingOccupantForm[]): ReservationRoomingOccupant[] {
  const primaryIndex = occupants.findIndex((occupant) => occupant.primary);
  return occupants.map((occupant, index) => ({
    firstName: occupant.firstName.trim(),
    lastName: occupant.lastName.trim(),
    documentType: occupant.documentType.trim() || null,
    documentNumber: occupant.documentNumber.trim() || null,
    phone: occupant.phone.trim() || null,
    nationality: occupant.nationality.trim() || null,
    ageCategory: occupant.ageCategory,
    primary: primaryIndex >= 0 ? index === primaryIndex : index === 0,
  }));
}

function firstIncompleteRoomingIndex(form: RoomingForm) {
  const index = form.occupants.findIndex(
    (occupant) => !occupant.firstName.trim() || !occupant.lastName.trim(),
  );
  return index >= 0 ? index : 0;
}

function buildDepositForm(reservation: OperationalReservation): ReservationDepositForm {
  return {
    depositAmount: toNumber(reservation.depositAmount) ? String(toNumber(reservation.depositAmount)) : "",
    depositPaid: reservation.depositPaid,
    depositMethod: reservation.depositMethod ?? "cash",
    depositReference: reservation.depositReference ?? "",
  };
}

function stayPreviewDays(reservation: OperationalReservation) {
  const start = parseDateOnly(reservation.checkInDate);
  const end = parseDateOnly(reservation.checkOutDate);
  const nights = Math.max(1, diffDays(start, end));
  const maxDays = Math.min(nights + 1, 8);
  return Array.from({ length: maxDays }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const isArrival = index === 0;
    const isDeparture = index === nights;
    return {
      date: date.toISOString(),
      kind: isArrival ? "arrival" : isDeparture ? "departure" : "stay",
      label: formatDate(date),
      value: isArrival ? DEFAULT_CHECK_IN_TIME : isDeparture ? DEFAULT_CHECK_OUT_TIME : "Noche",
      caption: isArrival ? "Entrada" : isDeparture ? "Salida" : `Dia ${index + 1}`,
    };
  });
}
