"use client";

import type { CSSProperties } from "react";
import {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { permissions, statusLabels, type PaymentMethod } from "@hotel-pms/shared";
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
  commercialStatus: string;
  cleaningStatus: string;
  maintenanceStatus: string;
  roomType: { id: string; code: string; name: string };
};

type Reservation = {
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
  roomType: { id: string; code: string; name: string };
  assignedRoom?: { id: string; number: string } | null;
  occupants?: ReservationOccupant[];
};

type Selection = {
  roomId: string;
  startIndex: number;
  endIndex: number;
};

type ReservationMove = {
  reservationId: string;
  originDayIndex: number;
  startX: number;
  startY: number;
  moved: boolean;
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

type MovePreview = {
  reservationId: string;
  roomId: string;
  startIndex: number;
  endIndex: number;
  valid: boolean;
};

const DEFAULT_CHECK_IN_TIME = "15:00";
const DEFAULT_CHECK_OUT_TIME = "11:00";
const CALENDAR_BOOKED_STATUSES = ["confirmed", "assigned", "in_house"];
const CALENDAR_DEPARTURE_STATUSES = [...CALENDAR_BOOKED_STATUSES, "completed"];
const ARGENTINA_HOLIDAYS_2026 = [
  { date: "2026-01-01", label: "Año Nuevo", type: "inamovible" },
  { date: "2026-02-16", label: "Carnaval", type: "inamovible" },
  { date: "2026-02-17", label: "Carnaval", type: "inamovible" },
  { date: "2026-03-20", label: "Fiesta de la Ruptura del Ayuno", type: "no_laborable" },
  { date: "2026-03-23", label: "Día no laborable con fines turísticos", type: "turistico" },
  { date: "2026-03-24", label: "Día Nacional de la Memoria por la Verdad y la Justicia", type: "inamovible" },
  { date: "2026-04-02", label: "Día del Veterano y de los Caídos en Malvinas", type: "inamovible" },
  { date: "2026-04-02", label: "Jueves Santo", type: "no_laborable" },
  { date: "2026-04-03", label: "Viernes Santo", type: "inamovible" },
  { date: "2026-04-02", label: "Primeros días de la Pascua Judía", type: "no_laborable" },
  { date: "2026-04-03", label: "Primeros días de la Pascua Judía", type: "no_laborable" },
  { date: "2026-04-08", label: "Últimos días de la Pascua Judía", type: "no_laborable" },
  { date: "2026-04-09", label: "Últimos días de la Pascua Judía", type: "no_laborable" },
  { date: "2026-04-24", label: "Día de acción por la tolerancia y respeto entre los pueblos", type: "no_laborable" },
  { date: "2026-05-01", label: "Día del Trabajador", type: "inamovible" },
  { date: "2026-05-25", label: "Día de la Revolución de Mayo", type: "inamovible" },
  { date: "2026-05-27", label: "Fiesta del Sacrificio", type: "no_laborable" },
  { date: "2026-06-15", label: "Paso a la Inmortalidad del Gral. Martín Miguel de Güemes", type: "trasladable" },
  { date: "2026-06-17", label: "Año Nuevo Islámico", type: "no_laborable" },
  { date: "2026-06-20", label: "Paso a la Inmortalidad del Gral. Manuel Belgrano", type: "inamovible" },
  { date: "2026-07-09", label: "Día de la Independencia", type: "inamovible" },
  { date: "2026-07-10", label: "Día no laborable con fines turísticos", type: "turistico" },
  { date: "2026-08-17", label: "Paso a la Inmortalidad del Gral. José de San Martín", type: "trasladable" },
  { date: "2026-09-12", label: "Año Nuevo Judío", type: "no_laborable" },
  { date: "2026-09-13", label: "Año Nuevo Judío", type: "no_laborable" },
  { date: "2026-09-21", label: "Día del Perdón", type: "no_laborable" },
  { date: "2026-10-12", label: "Día de la Raza", type: "trasladable" },
  { date: "2026-11-23", label: "Día de la Soberanía Nacional", type: "trasladable" },
  { date: "2026-12-07", label: "Día no laborable con fines turísticos", type: "turistico" },
  { date: "2026-12-08", label: "Inmaculada Concepción de María", type: "inamovible" },
  { date: "2026-12-25", label: "Navidad", type: "inamovible" },
  { date: "2027-01-01", label: "Año Nuevo", type: "inamovible" },
] as const;

const HOLIDAYS_BY_DATE = ARGENTINA_HOLIDAYS_2026.reduce<Record<string, string[]>>((acc, holiday) => {
  acc[holiday.date] = [...(acc[holiday.date] ?? []), holiday.label];
  return acc;
}, {});

export default function CalendarPage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <CalendarContent permissionsList={session.permissions} />
        </Shell>
      )}
    </Protected>
  );
}

function CalendarContent({ permissionsList }: { permissionsList: string[] }) {
  const canCreate = permissionsList.includes(permissions.reservationCreate);
  const canTransfer = permissionsList.includes(permissions.reservationTransfer);
  const canUpdate = permissionsList.includes(permissions.reservationUpdate);
  const canCheckIn = permissionsList.includes(permissions.reservationCheckIn);
  const canCheckOut = permissionsList.includes(permissions.reservationCheckOut);
  const canCreateInvoice = permissionsList.includes(permissions.invoiceCreate);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState(() => toDateInput(new Date()));
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [preferredRoomId, setPreferredRoomId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [movingReservationId, setMovingReservationId] = useState<string | null>(null);
  const [movingOriginDayIndex, setMovingOriginDayIndex] = useState<number | null>(null);
  const [movePreview, setMovePreview] = useState<MovePreview | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<Selection | null>(null);
  const moveRef = useRef<ReservationMove | null>(null);

  async function load() {
    const [roomRows, reservationRows] = await Promise.all([
      apiFetch<Room[]>("/rooms"),
      apiFetch<Reservation[]>("/reservations"),
    ]);
    setRooms(roomRows);
    setReservations(reservationRows);
    setSelectedFloor((current) => {
      if (current !== "all") return current;
      const preferredRoom = preferredRoomId
        ? roomRows.find((room) => room.id === preferredRoomId)
        : null;
      return preferredRoom?.floor ?? current;
    });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("roomId");
    const start = params.get("start");
    if (roomId) setPreferredRoomId(roomId);
    if (start) setSelectedStartDate(toDateInput(parseDateInput(start)));
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [preferredRoomId]);

  useEffect(() => {
    function stopDrag(event: MouseEvent | PointerEvent) {
      if (moveRef.current) {
        void finishReservationMove(event);
        return;
      }
      dragRef.current = null;
    }
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("mouseup", stopDrag);
    return () => {
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("mouseup", stopDrag);
    };
  });

  const days = useMemo(() => daysForOneMonthFrom(selectedStartDate), [selectedStartDate]);

  useEffect(() => {
    function trackDrag(event: MouseEvent | PointerEvent) {
      const move = moveRef.current;
      if (move) {
        updateMovePreviewFromPoint(event.clientX, event.clientY, move);
        return;
      }

      const draft = dragRef.current;
      if (!draft) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const cell = target instanceof HTMLElement ? target.closest<HTMLButtonElement>(".calendar-cell") : null;
      const roomId = cell?.dataset.roomId;
      const dayIndex = Number(cell?.dataset.dayIndex);
      if (!roomId || Number.isNaN(dayIndex) || roomId !== draft.roomId) return;
      if (!canSelectRange(roomId, draft.startIndex, dayIndex)) return;
      const next = { ...draft, endIndex: dayIndex };
      dragRef.current = next;
      setSelection(next);
    }

    window.addEventListener("pointermove", trackDrag);
    window.addEventListener("mousemove", trackDrag);
    return () => {
      window.removeEventListener("pointermove", trackDrag);
      window.removeEventListener("mousemove", trackDrag);
    };
  });

  const floors = useMemo(() => {
    const unique = Array.from(new Set(rooms.map((room) => room.floor ?? "Sin piso")));
    return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rooms]);

  const visibleRooms = useMemo(() => {
    const filtered =
      selectedFloor === "all"
        ? rooms
        : rooms.filter((room) => (room.floor ?? "Sin piso") === selectedFloor);
    return filtered.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [rooms, selectedFloor]);

  const selectionDetails = useMemo(() => {
    if (!selection) return null;
    const room = rooms.find((row) => row.id === selection.roomId);
    if (!room) return null;
    const { start, end } = normalizeSelection(selection);
    const checkIn = days[start];
    const checkOut = addUtcDays(days[end], 1);
    const nights = end - start + 1;
    return { room, checkIn, checkOut, nights };
  }, [days, rooms, selection]);

  const createReservationHref = selectionDetails
    ? `/reservations/new?roomId=${selectionDetails.room.id}&checkIn=${toDateInput(
        selectionDetails.checkIn,
      )}&checkOut=${toDateInput(selectionDetails.checkOut)}`
    : "";
  const movingReservation = movingReservationId
    ? reservations.find((reservation) => reservation.id === movingReservationId) ?? null
    : null;
  const selectedReservation = selectedReservationId
    ? reservations.find((reservation) => reservation.id === selectedReservationId) ?? null
    : null;
  const selectedReservationRoom = selectedReservation?.assignedRoom
    ? rooms.find((room) => room.id === selectedReservation.assignedRoom?.id) ?? null
    : null;

  function reservationCoversDay(reservation: Reservation, day: Date) {
    const checkIn = parseDateInput(reservation.checkInDate.slice(0, 10));
    const checkOut = parseDateInput(reservation.checkOutDate.slice(0, 10));
    return day >= checkIn && day < checkOut;
  }

  function reservationFor(roomId: string, day: Date) {
    return reservations.find((reservation) => {
      if (!reservation.assignedRoom || reservation.assignedRoom.id !== roomId) return false;
      if (!CALENDAR_BOOKED_STATUSES.includes(reservation.status)) return false;
      return reservationCoversDay(reservation, day);
    });
  }

  function reservationsStartingOn(roomId: string, day: Date) {
    const dayInput = toDateInput(day);
    return reservations.filter(
      (reservation) =>
        reservation.assignedRoom?.id === roomId &&
        CALENDAR_BOOKED_STATUSES.includes(reservation.status) &&
        reservation.checkInDate.slice(0, 10) === dayInput,
    );
  }

  function reservationsEndingOn(roomId: string, day: Date) {
    const dayInput = toDateInput(day);
    return reservations.filter(
      (reservation) =>
        reservation.assignedRoom?.id === roomId &&
        CALENDAR_DEPARTURE_STATUSES.includes(reservation.status) &&
        reservation.checkOutDate.slice(0, 10) === dayInput,
    );
  }

  function canSelectRange(roomId: string, startIndex: number, endIndex: number) {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    for (let index = start; index <= end; index += 1) {
      if (reservationFor(roomId, days[index])) return false;
    }
    return true;
  }

  function reservationDates(reservation: Reservation) {
    const checkIn = parseDateInput(reservation.checkInDate.slice(0, 10));
    const checkOut = parseDateInput(reservation.checkOutDate.slice(0, 10));
    return {
      checkIn,
      checkOut,
      nights: diffUtcDays(checkIn, checkOut),
    };
  }

  function reservationCalendarTone(reservation: Reservation) {
    if (reservation.status === "in_house") {
      const today = parseDateInput(toDateInput(new Date()));
      const { checkOut } = reservationDates(reservation);
      const daysUntilCheckout = diffUtcDays(today, checkOut);
      return daysUntilCheckout >= 0 && daysUntilCheckout <= 1 ? "departing" : "in-house";
    }
    if (reservation.status === "confirmed" || reservation.status === "assigned") return "reserved";
    if (reservation.status === "pending") return "pending";
    return "neutral";
  }

  function moveDatesFor(reservation: Reservation, targetDay: Date, originDayIndex: number) {
    const { checkIn, nights } = reservationDates(reservation);
    const originDay = days[originDayIndex] ?? checkIn;
    const originOffset = Math.max(0, diffUtcDays(checkIn, originDay));
    const nextCheckIn = addUtcDays(targetDay, -originOffset);
    return {
      checkIn: nextCheckIn,
      checkOut: addUtcDays(nextCheckIn, nights),
    };
  }

  function canMoveReservation(reservation: Reservation) {
    return (canTransfer || canUpdate) && ["confirmed", "assigned", "in_house"].includes(reservation.status);
  }

  function canMoveReservationToRange(
    reservation: Reservation,
    room: Room,
    checkIn: Date,
    checkOut: Date,
  ) {
    if (!canMoveReservation(reservation)) return false;
    const current = reservationDates(reservation);
    const roomChanged = reservation.assignedRoom?.id !== room.id;
    const dateChanged =
      toDateInput(current.checkIn) !== toDateInput(checkIn) ||
      toDateInput(current.checkOut) !== toDateInput(checkOut);

    if (!roomChanged && !dateChanged) return false;
    if (reservation.status === "in_house" && dateChanged) return false;
    if (dateChanged && !canUpdate) return false;
    if (roomChanged && reservation.status === "in_house" && !canTransfer) return false;
    if (roomChanged && reservation.status !== "in_house" && !canTransfer && !canUpdate) return false;
    if (room.roomType.id !== reservation.roomType.id) return false;
    if (room.commercialStatus === "blocked" || room.commercialStatus === "out_of_service") return false;
    if (room.maintenanceStatus === "out_of_service") return false;
    if (reservation.status === "in_house") {
      if (
        room.commercialStatus !== "available" ||
        room.cleaningStatus !== "clean" ||
        room.maintenanceStatus !== "ok"
      ) {
        return false;
      }
    }

    return !reservations.some((other) => {
      if (other.id === reservation.id || other.assignedRoom?.id !== room.id) return false;
      if (!["confirmed", "assigned", "in_house"].includes(other.status)) return false;
      const otherCheckIn = parseDateInput(other.checkInDate.slice(0, 10));
      const otherCheckOut = parseDateInput(other.checkOutDate.slice(0, 10));
      return checkIn < otherCheckOut && checkOut > otherCheckIn;
    });
  }

  function previewForMove(reservation: Reservation, room: Room, dayIndex: number, originDayIndex: number) {
    const targetDay = days[dayIndex];
    if (!targetDay) return null;
    const nextDates = moveDatesFor(reservation, targetDay, originDayIndex);
    const visibleIndexes = days
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => day >= nextDates.checkIn && day < nextDates.checkOut)
      .map(({ index }) => index);

    if (visibleIndexes.length === 0) return null;
    return {
      reservationId: reservation.id,
      roomId: room.id,
      startIndex: Math.min(...visibleIndexes),
      endIndex: Math.max(...visibleIndexes),
      valid: canMoveReservationToRange(reservation, room, nextDates.checkIn, nextDates.checkOut),
    };
  }

  function updateMovePreview(room: Room, dayIndex: number, move?: ReservationMove | null) {
    const activeMove =
      move ??
      (movingReservationId && movingOriginDayIndex !== null
        ? { reservationId: movingReservationId, originDayIndex: movingOriginDayIndex }
        : null);
    const reservation = activeMove
      ? reservations.find((row) => row.id === activeMove.reservationId)
      : null;
    if (!activeMove || !reservation) {
      setMovePreview(null);
      return;
    }
    setMovePreview(previewForMove(reservation, room, dayIndex, activeMove.originDayIndex));
  }

  function shouldStartMovePreview(x: number, y: number, move: ReservationMove) {
    if (move.moved) return true;
    const distance = Math.hypot(x - move.startX, y - move.startY);
    if (distance < 6) return false;
    move.moved = true;
    return true;
  }

  function updateMovePreviewFromPoint(x: number, y: number, move: ReservationMove) {
    if (!shouldStartMovePreview(x, y, move)) return;
    const target = document.elementFromPoint(x, y);
    const cell = target instanceof HTMLElement ? target.closest<HTMLButtonElement>(".calendar-cell") : null;
    const roomId = cell?.dataset.roomId;
    const dayIndex = Number(cell?.dataset.dayIndex);
    if (!roomId || Number.isNaN(dayIndex)) {
      setMovePreview(null);
      return;
    }
    const room = rooms.find((row) => row.id === roomId);
    if (!room) {
      setMovePreview(null);
      return;
    }
    updateMovePreview(room, dayIndex, move);
  }

  function openReservationDetail(reservation: Reservation) {
    setSelectedReservationId(reservation.id);
    setPreferredRoomId(reservation.assignedRoom?.id ?? null);
    setSelection(null);
    setMovingReservationId(null);
    setMovingOriginDayIndex(null);
    setMovePreview(null);
    moveRef.current = null;
    dragRef.current = null;
  }

  function closeReservationDetail() {
    setSelectedReservationId(null);
  }

  async function runReservationAction(
    reservation: Reservation,
    action: "confirm" | "cancel" | "check-in" | "check-out",
  ) {
    setError(null);
    setBusyAction(action);
    try {
      await apiFetch(`/reservations/${reservation.id}/${action}`, {
        method: "POST",
        body: action === "cancel" ? JSON.stringify({ reason: "Cancelacion desde calendario" }) : "{}",
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

  function isMovePreviewCell(roomId: string, dayIndex: number, valid?: boolean) {
    if (!movePreview || movePreview.roomId !== roomId) return false;
    if (valid !== undefined && movePreview.valid !== valid) return false;
    return dayIndex >= movePreview.startIndex && dayIndex <= movePreview.endIndex;
  }

  function isActiveReservationMove() {
    return Boolean(movingReservation && (!moveRef.current || moveRef.current.moved));
  }

  function startReservationDrag(
    event: ReactDragEvent<HTMLButtonElement>,
    reservation: Reservation,
    dayIndex: number,
  ) {
    if (!canMoveReservation(reservation)) {
      event.preventDefault();
      return;
    }
    setMovingReservationId(reservation.id);
    setMovingOriginDayIndex(dayIndex);
    setMovePreview(null);
    setSelection(null);
    setError(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", reservation.id);
    event.dataTransfer.setData("application/x-origin-day-index", String(dayIndex));
  }

  function startReservationMove(
    event: ReactMouseEvent<HTMLButtonElement> | ReactPointerEvent<HTMLButtonElement>,
    reservation: Reservation,
    dayIndex: number,
  ) {
    if (event.button !== 0) return;
    if (!canMoveReservation(reservation)) return;
    event.preventDefault();
    moveRef.current = {
      reservationId: reservation.id,
      originDayIndex: dayIndex,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    dragRef.current = null;
    setMovingReservationId(reservation.id);
    setMovingOriginDayIndex(dayIndex);
    setMovePreview(null);
    setSelection(null);
    setError(null);
  }

  async function handleCalendarCellClick(room: Room, day: Date, reservation?: Reservation) {
    if (moveRef.current) return;
    const targetDayIndex = days.findIndex((row) => row.getTime() === day.getTime());
    if (
      movingReservation &&
      reservation?.id === movingReservation.id &&
      movingOriginDayIndex === targetDayIndex &&
      reservation.assignedRoom?.id === room.id
    ) {
      setMovingReservationId(reservation.id);
      setMovingOriginDayIndex(targetDayIndex);
      setMovePreview(null);
      setSelection(null);
      setError(null);
      return;
    }

    if (movingReservation) {
      await moveReservationToCell(movingReservation, room, targetDayIndex, movingOriginDayIndex ?? targetDayIndex);
      return;
    }

    if (reservation) {
      openReservationDetail(reservation);
      return;
    }
  }

  function handleReservationDragOver(
    event: ReactDragEvent<HTMLButtonElement>,
    room: Room,
    reservation?: Reservation,
  ) {
    if (!movingReservation) return;
    if (reservation && reservation.id !== movingReservation.id) return;
    const dayIndex = Number(event.currentTarget.dataset.dayIndex);
    const originDayIndex = movingOriginDayIndex ?? dayIndex;
    const preview = previewForMove(movingReservation, room, dayIndex, originDayIndex);
    setMovePreview(preview);
    if (!preview?.valid) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async function moveReservationToCell(
    reservation: Reservation,
    room: Room,
    targetDayIndex: number,
    originDayIndex: number,
  ) {
    if (!reservation) return;
    const targetDay = days[targetDayIndex];
    if (!targetDay) return;

    const nextDates = moveDatesFor(reservation, targetDay, originDayIndex);
    const currentDates = reservationDates(reservation);
    const roomChanged = reservation.assignedRoom?.id !== room.id;
    const dateChanged =
      toDateInput(currentDates.checkIn) !== toDateInput(nextDates.checkIn) ||
      toDateInput(currentDates.checkOut) !== toDateInput(nextDates.checkOut);

    if (!roomChanged && !dateChanged) {
      setMovingReservationId(null);
      setMovingOriginDayIndex(null);
      setMovePreview(null);
      moveRef.current = null;
      return;
    }

    if (!canMoveReservationToRange(reservation, room, nextDates.checkIn, nextDates.checkOut)) {
      setError("No se puede mover ahi: hay conflicto de fechas, tipo o estado.");
      setMovingReservationId(null);
      setMovingOriginDayIndex(null);
      setMovePreview(null);
      moveRef.current = null;
      return;
    }

    setError(null);
    try {
      if (roomChanged && !dateChanged && canTransfer) {
        await apiFetch(`/reservations/${reservation.id}/transfer-room`, {
          method: "POST",
          body: JSON.stringify({
            roomId: room.id,
            reason: "Cambio desde calendario operativo",
          }),
        });
      } else {
        await apiFetch(`/reservations/${reservation.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            assignedRoomId: room.id,
            checkInDate: toDateInput(nextDates.checkIn),
            checkOutDate: toDateInput(nextDates.checkOut),
          }),
        });
      }
      setPreferredRoomId(room.id);
      setMovingReservationId(null);
      setMovingOriginDayIndex(null);
      setMovePreview(null);
      moveRef.current = null;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo mover la reserva.");
      setMovingReservationId(null);
      setMovingOriginDayIndex(null);
      setMovePreview(null);
      moveRef.current = null;
    }
  }

  async function dropReservationOnRoom(event: ReactDragEvent<HTMLButtonElement>, room: Room) {
    event.preventDefault();
    const reservationId = event.dataTransfer.getData("text/plain") || movingReservationId;
    const reservation = reservations.find((row) => row.id === reservationId);
    if (!reservation) return;
    const dayIndex = Number(event.currentTarget.dataset.dayIndex);
    const originDayIndex = Number(event.dataTransfer.getData("application/x-origin-day-index"));
    await moveReservationToCell(
      reservation,
      room,
      dayIndex,
      Number.isNaN(originDayIndex) ? movingOriginDayIndex ?? dayIndex : originDayIndex,
    );
  }

  async function finishReservationMove(event: MouseEvent | PointerEvent) {
    const move = moveRef.current;
    moveRef.current = null;
    const reservationId = move?.reservationId ?? movingReservationId;
    setMovingReservationId(null);
    setMovingOriginDayIndex(null);
    setMovePreview(null);
    if (!reservationId) return;

    const reservation = reservations.find((row) => row.id === reservationId);
    if (reservation && !move?.moved) {
      openReservationDetail(reservation);
      return;
    }

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const cell = target instanceof HTMLElement ? target.closest<HTMLButtonElement>(".calendar-cell") : null;
    const roomId = cell?.dataset.roomId;
    const dayIndex = Number(cell?.dataset.dayIndex);
    if (!reservation || !roomId || Number.isNaN(dayIndex)) return;

    const room = rooms.find((row) => row.id === roomId);
    if (!room) return;
    await moveReservationToCell(reservation, room, dayIndex, move?.originDayIndex ?? movingOriginDayIndex ?? dayIndex);
  }

  function startSelection(
    event: ReactPointerEvent<HTMLButtonElement>,
    room: Room,
    dayIndex: number,
  ) {
    if (event.button !== 0) return;
    selectStart(room, dayIndex);
  }

  function startMouseSelection(
    event: ReactMouseEvent<HTMLButtonElement>,
    room: Room,
    dayIndex: number,
  ) {
    if (event.button !== 0) return;
    selectStart(room, dayIndex);
  }

  function selectStart(room: Room, dayIndex: number) {
    if (reservationFor(room.id, days[dayIndex])) return;
    const next = { roomId: room.id, startIndex: dayIndex, endIndex: dayIndex };
    dragRef.current = next;
    setPreferredRoomId(room.id);
    setSelection(next);
    setError(null);
  }

  function extendSelection(roomId: string, dayIndex: number) {
    const draft = dragRef.current;
    if (!draft || draft.roomId !== roomId) return;
    if (!canSelectRange(roomId, draft.startIndex, dayIndex)) return;
    const next = { ...draft, endIndex: dayIndex };
    dragRef.current = next;
    setSelection(next);
  }

  function finishSelection(roomId: string, dayIndex: number) {
    const draft = dragRef.current;
    if (!draft || draft.roomId !== roomId) return;
    if (!canSelectRange(roomId, draft.startIndex, dayIndex)) return;
    setSelection({ ...draft, endIndex: dayIndex });
    dragRef.current = null;
  }

  function moveCalendar(monthsToMove: number) {
    setSelectedStartDate(toDateInput(addUtcMonths(parseDateInput(selectedStartDate), monthsToMove)));
    setSelection(null);
    setMovingReservationId(null);
    setMovingOriginDayIndex(null);
    setMovePreview(null);
  }

  function moveCalendarToToday() {
    setSelectedStartDate(toDateInput(new Date()));
    setSelection(null);
    setMovingReservationId(null);
    setMovingOriginDayIndex(null);
    setMovePreview(null);
  }

  function reservationBarsForRoom(room: Room) {
    const viewStart = days[0];
    const viewEndExclusive = days[days.length - 1] ? addUtcDays(days[days.length - 1], 1) : null;
    if (!viewStart || !viewEndExclusive) return [];

    return reservations
      .filter((reservation) => {
        if (reservation.assignedRoom?.id !== room.id) return false;
        if (!CALENDAR_BOOKED_STATUSES.includes(reservation.status)) return false;
        const { checkIn, checkOut } = reservationDates(reservation);
        return checkIn < viewEndExclusive && checkOut > viewStart;
      })
      .map((reservation) => {
        const { checkIn, checkOut, nights } = reservationDates(reservation);
        const startIndex = Math.max(0, diffUtcDays(viewStart, checkIn));
        const endIndex = Math.min(days.length, diffUtcDays(viewStart, checkOut));
        const spanDays = Math.max(1, endIndex - startIndex);
        return {
          reservation,
          nights,
          startIndex,
          endIndex,
          spanDays,
          startsInView: checkIn >= viewStart,
        };
      })
      .filter((bar) => bar.endIndex > bar.startIndex)
      .sort(
        (first, second) =>
          first.startIndex - second.startIndex ||
          first.endIndex - second.endIndex ||
          first.reservation.code.localeCompare(second.reservation.code),
      )
      .map((bar, index) => ({
        ...bar,
        reservedBand: index % 2 === 0 ? "a" : "b",
      }));
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Calendario operativo</h1>
          <p>{formatCalendarWindowTitle(days)}</p>
          <div className="calendar-legend" aria-label="Referencia del calendario">
            <span>
              <i className="legend-out" />
              Salida {DEFAULT_CHECK_OUT_TIME}
            </span>
            <span>
              <i className="legend-in" />
              Entrada {DEFAULT_CHECK_IN_TIME}
            </span>
            <span>
              <i className="legend-reserved" />
              Reserva
            </span>
            <span>
              <i className="legend-reserved-alt" />
              Reserva siguiente
            </span>
            <span>
              <i className="legend-in-house" />
              Check-in hecho
            </span>
            <span>
              <i className="legend-departing" />
              Por salir
            </span>
            <span>
              <i className="legend-calendar-holiday" />
              Feriado/no laborable
            </span>
            <span>
              <i className="legend-calendar-weekend" />
              Sab/dom
            </span>
          </div>
        </div>
        <div className="calendar-toolbar">
          <button onClick={() => moveCalendar(-1)}>Anterior</button>
          <input
            aria-label="Inicio del calendario"
            type="date"
            value={selectedStartDate}
            onChange={(event) => setSelectedStartDate(event.target.value)}
          />
          <button onClick={moveCalendarToToday}>Hoy</button>
          <button onClick={() => moveCalendar(1)}>Siguiente</button>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <div className="floor-tabs calendar-floor-tabs">
        <button className={selectedFloor === "all" ? "active" : ""} onClick={() => setSelectedFloor("all")}>
          Todos
        </button>
        {floors.map((floor) => (
          <button
            className={selectedFloor === floor ? "active" : ""}
            key={floor}
            onClick={() => setSelectedFloor(floor)}
          >
            Piso {floor}
          </button>
        ))}
      </div>

      <section className="panel calendar-selection-panel">
        <div className="calendar-selection-strip">
          <div>
            <span>Habitacion</span>
            <strong>{selectionDetails?.room.number ?? "-"}</strong>
          </div>
          <div>
            <span>Llegada</span>
            <strong>
              {selectionDetails
                ? formatStayEndpoint(selectionDetails.checkIn, DEFAULT_CHECK_IN_TIME)
                : "-"}
            </strong>
          </div>
          <div>
            <span>Salida</span>
            <strong>
              {selectionDetails
                ? formatStayEndpoint(selectionDetails.checkOut, DEFAULT_CHECK_OUT_TIME)
                : "-"}
            </strong>
          </div>
          <div>
            <span>Noches</span>
            <strong>{selectionDetails?.nights ?? "-"}</strong>
          </div>
        </div>
        {selectionDetails && canCreate ? (
          <a className="primary-button link-button" href={createReservationHref} rel="noreferrer" target="_blank">
            Crear reserva
          </a>
        ) : (
          <button className="primary-button" disabled>
            Crear reserva
          </button>
        )}
      </section>

      <section className="panel calendar-panel">
        <div
          className="calendar-grid"
          style={{
            gridTemplateColumns: `104px repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="calendar-head calendar-corner">Habitacion</div>
          {days.map((day) => {
            const holidayLabels = holidayLabelsFor(day);
            const dayIsWeekend = isWeekend(day);
            return (
              <div
                className={`calendar-head calendar-day-head ${
                  holidayLabels.length ? "holiday" : dayIsWeekend ? "weekend" : ""
                }`}
                key={day.toISOString()}
                title={holidayLabels.length ? holidayLabels.join(" / ") : dayIsWeekend ? "Sabado/domingo" : undefined}
              >
                <strong>{formatWeekdayInitial(day)}</strong>
                <span>{formatDayNumber(day)}</span>
              </div>
            );
          })}
          {visibleRooms.map((room, roomIndex) => {
            const isPreferred = preferredRoomId === room.id;
            const stayBars = reservationBarsForRoom(room);
            return (
              <div className="calendar-row-fragment" key={room.id}>
                <div
                  className={`calendar-room ${isPreferred ? "preferred" : ""}`}
                  style={{
                    gridColumn: 1,
                    gridRow: roomIndex + 2,
                  }}
                >
                  <strong>{room.number}</strong>
                  <span>
                    {room.roomType.code} - Piso {room.floor ?? "-"}
                  </span>
                </div>
                {days.map((day, dayIndex) => {
                  const reservation = reservationFor(room.id, day);
                  const arrivals = reservationsStartingOn(room.id, day);
                  const departures = reservationsEndingOn(room.id, day);
                  const cellReservation = reservation ?? arrivals[0] ?? departures[0];
                  const holidayLabels = holidayLabelsFor(day);
                  const dayIsWeekend = isWeekend(day);
                  const isArrival = reservation
                    ? reservation.checkInDate.slice(0, 10) === toDateInput(day)
                    : false;
                  const selected = isSelectedCell(selection, room.id, dayIndex);
                  const previewValid = isMovePreviewCell(room.id, dayIndex, true);
                  const previewInvalid = isMovePreviewCell(room.id, dayIndex, false);
                  return (
                    <button
                      className={`calendar-cell ${reservation ? "booked" : ""} ${
                        arrivals.length ? "arrival" : ""
                      } ${departures.length ? "departure" : ""} ${
                        arrivals.length && departures.length ? "turnover" : ""
                      } ${holidayLabels.length ? "holiday" : dayIsWeekend ? "weekend" : ""
                      } ${
                        selected ? "selected" : ""
                      } ${movingReservationId === reservation?.id ? "moving" : ""} ${
                        previewValid ? "move-preview" : ""
                      } ${previewInvalid ? "move-preview-invalid" : ""
                      }`}
                      data-day-index={dayIndex}
                      data-room-id={room.id}
                      draggable={false}
                      key={`${room.id}-${day.toISOString()}`}
                      style={{
                        gridColumn: dayIndex + 2,
                        gridRow: roomIndex + 2,
                      }}
                      onDragEnd={() => setMovingReservationId(null)}
                      onDragOver={(event) => handleReservationDragOver(event, room, reservation)}
                      onDragStart={(event) =>
                        reservation ? startReservationDrag(event, reservation, dayIndex) : undefined
                      }
                      onDrop={(event) => dropReservationOnRoom(event, room)}
                      onClick={() => handleCalendarCellClick(room, day, cellReservation)}
                      onMouseDown={(event) =>
                        reservation
                          ? startReservationMove(event, reservation, dayIndex)
                          : movingReservation
                            ? undefined
                            : startMouseSelection(event, room, dayIndex)
                      }
                      onMouseEnter={() =>
                        isActiveReservationMove()
                          ? updateMovePreview(room, dayIndex)
                          : extendSelection(room.id, dayIndex)
                      }
                      onMouseMove={() => {
                        if (isActiveReservationMove()) updateMovePreview(room, dayIndex);
                      }}
                      onMouseUp={() => finishSelection(room.id, dayIndex)}
                      onPointerDown={(event) =>
                        reservation
                          ? startReservationMove(event, reservation, dayIndex)
                          : movingReservation
                            ? undefined
                            : startSelection(event, room, dayIndex)
                      }
                      onPointerEnter={() =>
                        isActiveReservationMove()
                          ? updateMovePreview(room, dayIndex)
                          : extendSelection(room.id, dayIndex)
                      }
                      onPointerMove={() => {
                        if (isActiveReservationMove()) updateMovePreview(room, dayIndex);
                      }}
                      onPointerUp={() => finishSelection(room.id, dayIndex)}
                      type="button"
                      title={calendarCellTitle(reservation, arrivals, departures, holidayLabels)}
                    >
                      <span className="calendar-cell-events">
                        <span
                          className={`calendar-half calendar-half-out ${
                            departures.length ? "has-event" : ""
                          }`}
                        >
                          {departures[0] ? (
                            <span className="calendar-event departure-event">
                              {DEFAULT_CHECK_OUT_TIME}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`calendar-half ${
                            isArrival ? "calendar-half-in" : "calendar-half-stay"
                          } ${
                            reservation ? `has-event calendar-tone-${reservationCalendarTone(reservation)}` : ""
                          }`}
                        >
                          {reservation ? (
                            <span className={`calendar-event ${isArrival ? "arrival-event" : "stay-event"}`}>
                              {isArrival ? DEFAULT_CHECK_IN_TIME : ""}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {stayBars.map((bar) => (
                  <button
                    className={`calendar-stay-bar calendar-status-${reservationCalendarTone(
                      bar.reservation,
                    )} calendar-band-${bar.reservedBand} ${
                      movingReservationId === bar.reservation.id ? "moving" : ""
                    }`}
                    key={`bar-${bar.reservation.id}`}
                    onMouseDown={(event) =>
                      startReservationMove(event, bar.reservation, bar.startIndex)
                    }
                    onPointerDown={(event) =>
                      startReservationMove(event, bar.reservation, bar.startIndex)
                    }
                    style={{
                      gridColumn: `${bar.startIndex + 2} / ${bar.endIndex + 2}`,
                      gridRow: roomIndex + 2,
                      "--stay-bar-start-offset": bar.startsInView
                        ? `calc((100% / ${bar.spanDays}) + 4px)`
                        : "4px",
                    } as CSSProperties}
                    title={calendarCellTitle(bar.reservation, [bar.reservation], [])}
                    type="button"
                  >
                    <span>{formatGuestName(bar.reservation)}</span>
                    <small>{bar.nights}n</small>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {selectedReservation ? (
        <ReservationOperationalDrawer
          busyAction={busyAction}
          canCheckIn={canCheckIn}
          canCheckOut={canCheckOut}
          canCreateInvoice={canCreateInvoice}
          canUpdate={canUpdate}
          onCheckIn={(reservation) => runReservationAction(reservation as Reservation, "check-in")}
          onCheckOut={(reservation) => runReservationAction(reservation as Reservation, "check-out")}
          onCancel={(reservation) => runReservationAction(reservation as Reservation, "cancel")}
          onClose={closeReservationDetail}
          onConfirm={(reservation) => runReservationAction(reservation as Reservation, "confirm")}
          onOpenCalendar={(reservation) => openReservationCalendar(reservation as Reservation)}
          onOpenReservations={() => {
            window.location.href = "/reservations";
          }}
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

function normalizeSelection(selection: Selection) {
  return {
    start: Math.min(selection.startIndex, selection.endIndex),
    end: Math.max(selection.startIndex, selection.endIndex),
  };
}

function isSelectedCell(selection: Selection | null, roomId: string, dayIndex: number) {
  if (!selection || selection.roomId !== roomId) return false;
  const { start, end } = normalizeSelection(selection);
  return dayIndex >= start && dayIndex <= end;
}

function parseDateInput(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function daysForOneMonthFrom(value: string) {
  const firstDay = parseDateInput(value);
  const lastDayExclusive = addUtcMonths(firstDay, 1);
  const days = Math.max(1, diffUtcDays(firstDay, lastDayExclusive));
  return Array.from({ length: days }, (_, index) => addUtcDays(firstDay, index));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(date.getUTCDate() + days);
  return next;
}

function diffUtcDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function addUtcMonths(date: Date, months: number) {
  const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth(),
      Math.min(date.getUTCDate(), lastDayOfTargetMonth),
    ),
  );
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function holidayLabelsFor(date: Date) {
  return HOLIDAYS_BY_DATE[toDateInput(date)] ?? [];
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function formatDayNumber(date: Date) {
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatWeekdayInitial(date: Date) {
  return date
    .toLocaleDateString("es-AR", { weekday: "short", timeZone: "UTC" })
    .slice(0, 1);
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function formatStayEndpoint(date: Date, time: string) {
  return `${formatLongDate(date)} ${time}`;
}

function formatGuestName(reservation: Reservation) {
  return `${reservation.guest.firstName} ${reservation.guest.lastName}`;
}

function formatReservationGuestSummary(reservation: Reservation) {
  const occupants = reservation.occupants?.length
    ? reservation.occupants.map((occupant) => `${occupant.lastName}, ${occupant.firstName}`)
    : [`${reservation.guest.lastName}, ${reservation.guest.firstName}`];
  return occupants.join(" / ");
}

function formatMoneyValue(value?: string | number | null, currency = "ARS") {
  const amount = Number(value ?? 0);
  if (!amount) return "-";
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }
}

function reservationStatusTone(status: string) {
  if (status === "cancelled" || status === "no_show") return "bad";
  if (status === "pending") return "warn";
  if (status === "in_house" || status === "completed") return "good";
  return "";
}

function formatCalendarWindowTitle(days: Date[]) {
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  if (!firstDay || !lastDay) return "Un mes desde hoy";
  return `${formatLongDate(firstDay)} - ${formatLongDate(lastDay)} - ${days.length} dias`;
}

function calendarCellTitle(
  reservation: Reservation | undefined,
  arrivals: Reservation[],
  departures: Reservation[],
  holidayLabels: string[] = [],
) {
  const lines = [
    ...holidayLabels.map((label) => `Dia especial: ${label}`),
    ...departures.map(
      (item) =>
        `Salida ${DEFAULT_CHECK_OUT_TIME}: ${formatReservationGuestSummary(item)} (${item.code})`,
    ),
    ...arrivals.map(
      (item) =>
        `Entrada ${DEFAULT_CHECK_IN_TIME}: ${formatReservationGuestSummary(item)} (${item.code})`,
    ),
  ];
  if (reservation && !arrivals.some((item) => item.id === reservation.id)) {
    lines.push(
      `Alojada: ${formatReservationGuestSummary(reservation)} (${reservation.code})`,
    );
  }
  return lines.join("\n");
}
