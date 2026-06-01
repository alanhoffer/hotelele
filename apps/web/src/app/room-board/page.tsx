"use client";

import {
  DragEvent as ReactDragEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  CreditCard,
  DoorOpen,
  LayoutGrid,
  List,
  Map as MapIcon,
  Move,
  PlusCircle,
  ReceiptText,
  RotateCcw,
  Search,
  Sparkles,
  UserRound,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import {
  chargeKindLabels,
  chargeKinds,
  cleaningStatuses,
  commercialStatuses,
  maintenanceStatuses,
  paymentMethodLabels,
  paymentMethods,
  permissions,
  statusLabels,
} from "@hotel-pms/shared";
import type { ChargeKind, PaymentMethod } from "@hotel-pms/shared";
import { Protected } from "../../components/protected";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

type Room = {
  id: string;
  number: string;
  floor?: string | null;
  block?: string | null;
  capacity: number;
  commercialStatus: string;
  cleaningStatus: string;
  maintenanceStatus: string;
  roomType: { id: string; code: string; name: string };
};

type Reservation = {
  id: string;
  code: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  currency: string;
  depositAmount?: string | number | null;
  depositPaid: boolean;
  depositMethod?: PaymentMethod | null;
  depositReference?: string | null;
  guest: {
    firstName: string;
    lastName: string;
    documentType?: string | null;
    documentNumber?: string | null;
    phone?: string | null;
    nationality?: string | null;
  };
  roomType: { id: string; code: string; name: string };
  assignedRoom?: { id: string; number: string } | null;
  occupants?: ReservationOccupant[];
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

type SessionPermissions = {
  canCreate: boolean;
  canUpdate: boolean;
  canUpdateRoom: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  canViewFolio: boolean;
  canCreateCharge: boolean;
  canCreatePayment: boolean;
  canVoidCharge: boolean;
  canVoidPayment: boolean;
  canTransferRoom: boolean;
  canCreateInvoice: boolean;
};

type ReservationForm = {
  firstName: string;
  lastName: string;
  phone: string;
  checkInDate: string;
  checkOutDate: string;
  adults: string;
  children: string;
  totalAmount: string;
  depositAmount: string;
  depositPaid: boolean;
  depositMethod: PaymentMethod;
  depositReference: string;
  notes: string;
};

type BoardPoint = {
  x: number;
  y: number;
};

type BoardLayout = Record<string, BoardPoint>;

type DragState = {
  roomId: string;
  pointerId: number;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type OrderDragState = {
  roomId: string;
  pointerId: number;
  originX: number;
  originY: number;
  moved: boolean;
};

type ContextMenuState = {
  roomId: string;
  x: number;
  y: number;
};

type DrawerMode = "info" | "reservation";
type RoomInlinePanel = "check_in" | "charge" | "payment" | "transfer" | "status" | null;
type RoomDetailView = "detail" | "payments" | "operation" | "movements" | "calendar";
type BoardViewMode = "map" | "grid" | "list";
type BoardStatusFilter = "all" | "occupied" | "reserved" | "free" | "dirty" | "maintenance" | "blocked";

type RoomActionKind =
  | "create_reservation"
  | "confirm_reservation"
  | "check_in"
  | "settle_account"
  | "ready_check_out"
  | "housekeeping"
  | "maintenance"
  | "blocked"
  | "unavailable"
  | "occupied_unknown"
  | "account_loading";

type RoomActionFlow = {
  kind: RoomActionKind;
  title: string;
  description: string;
  tone: "neutral" | "good" | "warn" | "bad";
};

type Folio = {
  id: string;
  status: string;
  currency: string;
  openedAt: string;
  closedAt?: string | null;
  reservation: Reservation;
  charges: {
    id: string;
    kind: ChargeKind;
    description: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
    postedAt: string;
  }[];
  payments: {
    id: string;
    method: PaymentMethod;
    currency: string;
    amount: number;
    reference?: string | null;
    paidAt: string;
  }[];
  totals: {
    charges: number;
    payments: number;
    balance: number;
  };
};

type ChargeForm = {
  kind: ChargeKind;
  description: string;
  quantity: string;
  unitAmount: string;
};

type PaymentForm = {
  method: PaymentMethod;
  amount: string;
  reference: string;
};

type CheckInForm = {
  adults: string;
  children: string;
  occupants: ReservationOccupantForm[];
};

type ReservationOccupantForm = {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  phone: string;
  nationality: string;
  ageCategory: "adult" | "child";
  primary: boolean;
};

const BOARD_STORAGE_KEY = "hotel-pms-room-board-layout-v1";
const BOARD_ORDER_STORAGE_KEY = "hotel-pms-room-board-order-v1";
const BOARD_VIEW_OPTIONS: { key: BoardViewMode; label: string }[] = [
  { key: "map", label: "Mapa" },
  { key: "grid", label: "Grilla" },
  { key: "list", label: "Lista" },
];
const TILE_WIDTH = 150;
const TILE_HEIGHT = 110;
const TILE_GAP = 8;
const BOARD_PADDING = 24;
const GRID_SIZE = 10;
const DEFAULT_COLUMNS = 5;
const ACTIVE_ROOM_RESERVATION_STATUSES = ["pending", "confirmed", "assigned", "in_house"];
const BOARD_STATUS_FILTERS: { key: BoardStatusFilter; label: string }[] = [
  { key: "occupied", label: "Ocupada" },
  { key: "reserved", label: "Reservada" },
  { key: "free", label: "Libre" },
  { key: "dirty", label: "Por limpiar" },
  { key: "maintenance", label: "Mantenim." },
  { key: "blocked", label: "Bloqueada" },
];

export default function RoomBoardPage() {
  return (
    <Protected>
      {(session) => (
        <Shell>
          <RoomBoardContent
            permissionsState={{
              canCreate: session.permissions.includes(permissions.reservationCreate),
              canUpdate: session.permissions.includes(permissions.reservationUpdate),
              canUpdateRoom: session.permissions.includes(permissions.roomUpdateStatus),
              canCheckIn: session.permissions.includes(permissions.reservationCheckIn),
              canCheckOut: session.permissions.includes(permissions.reservationCheckOut),
              canViewFolio: session.permissions.includes(permissions.folioView),
              canCreateCharge: session.permissions.includes(permissions.folioChargeCreate),
              canCreatePayment: session.permissions.includes(permissions.folioPaymentCreate),
              canVoidCharge: session.permissions.includes(permissions.folioChargeVoid),
              canVoidPayment: session.permissions.includes(permissions.folioPaymentVoid),
              canTransferRoom: session.permissions.includes(permissions.reservationTransfer),
              canCreateInvoice: session.permissions.includes(permissions.invoiceCreate),
            }}
          />
        </Shell>
      )}
    </Protected>
  );
}

function RoomBoardContent({ permissionsState }: { permissionsState: SessionPermissions }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>("all");
  const [boardStatusFilter, setBoardStatusFilter] = useState<BoardStatusFilter>("all");
  const [boardQuery, setBoardQuery] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [boardView, setBoardView] = useState<BoardViewMode>("map");
  const [layoutMode, setLayoutMode] = useState(false);
  const [layout, setLayout] = useState<BoardLayout>({});
  const [layoutReady, setLayoutReady] = useState(false);
  const [roomOrder, setRoomOrder] = useState<string[]>([]);
  const [roomOrderReady, setRoomOrderReady] = useState(false);
  const [draggingOrderRoomId, setDraggingOrderRoomId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("info");
  const [roomPanel, setRoomPanel] = useState<RoomInlinePanel>(null);
  const [roomView, setRoomView] = useState<RoomDetailView>("detail");
  const [roomCalendarMonth, setRoomCalendarMonth] = useState(() => toMonthInput(new Date()));
  const [folio, setFolio] = useState<Folio | null>(null);
  const [folioLoading, setFolioLoading] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [form, setForm] = useState<ReservationForm>(() => initialReservationForm());
  const [chargeForm, setChargeForm] = useState<ChargeForm>(() => initialChargeForm());
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(() => initialPaymentForm());
  const [checkInForm, setCheckInForm] = useState<CheckInForm>(() => initialCheckInForm());
  const [transferRoomId, setTransferRoomId] = useState("");
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const orderDragRef = useRef<string | null>(null);
  const orderPointerDragRef = useRef<OrderDragState | null>(null);
  const lastDraggedRoomRef = useRef<string | null>(null);

  async function load() {
    const [roomRows, reservationRows] = await Promise.all([
      apiFetch<Room[]>("/rooms"),
      apiFetch<Reservation[]>("/reservations"),
    ]);
    setRooms(roomRows);
    setReservations(reservationRows);
    setSelectedFloor((current) => (current === "all" ? roomRows[0]?.floor ?? "all" : current));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedRoomId || !permissionsState.canViewFolio) {
      setFolio(null);
      return;
    }
    loadFolio(selectedRoomId).catch((err) => setError(err.message));
  }, [permissionsState.canViewFolio, reservations, selectedRoomId]);

  useEffect(() => {
    const saved = window.localStorage.getItem(BOARD_STORAGE_KEY);
    if (!saved) {
      setLayoutReady(true);
      return;
    }
    try {
      setLayout(JSON.parse(saved) as BoardLayout);
    } catch {
      window.localStorage.removeItem(BOARD_STORAGE_KEY);
    } finally {
      setLayoutReady(true);
    }
  }, []);

  useEffect(() => {
    if (!layoutReady) return;
    window.localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(layout));
  }, [layout, layoutReady]);

  useEffect(() => {
    const saved = window.localStorage.getItem(BOARD_ORDER_STORAGE_KEY);
    if (!saved) {
      setRoomOrderReady(true);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setRoomOrder(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
    } catch {
      window.localStorage.removeItem(BOARD_ORDER_STORAGE_KEY);
    } finally {
      setRoomOrderReady(true);
    }
  }, []);

  useEffect(() => {
    if (!roomOrderReady) return;
    window.localStorage.setItem(BOARD_ORDER_STORAGE_KEY, JSON.stringify(roomOrder));
  }, [roomOrder, roomOrderReady]);

  useEffect(() => {
    if (!roomOrderReady || rooms.length === 0) return;
    setRoomOrder((current) => {
      const next = mergeRoomOrder(current, rooms);
      return sameStringArray(current, next) ? current : next;
    });
  }, [roomOrderReady, rooms]);

  useEffect(() => {
    if (boardView !== "map") setLayoutMode(false);
  }, [boardView]);

  useEffect(() => {
    function closeMenus() {
      setContextMenu(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
        setSelectedRoomId(null);
        setDrawerMode("info");
      }
    }

    window.addEventListener("click", closeMenus);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", closeMenus);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const floors = useMemo(() => {
    const unique = Array.from(new Set(rooms.map((room) => room.floor ?? "Sin piso")));
    return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rooms]);

  const visibleRooms = useMemo(() => {
    const query = normalizeSearch(boardQuery);
    const orderIndex = new Map(roomOrder.map((roomId, index) => [roomId, index]));
    const filteredByFloor =
      selectedFloor === "all"
        ? rooms
        : rooms.filter((room) => (room.floor ?? "Sin piso") === selectedFloor);
    return filteredByFloor
      .filter((room) => {
        const reservation = activeReservationForRoom(room, reservations);
        if (boardStatusFilter !== "all" && getBoardStatusKey(room, reservation) !== boardStatusFilter) {
          return false;
        }
        if (!query) return true;
        const haystack = normalizeSearch(
          [
            room.number,
            room.floor,
            room.block,
            room.roomType.code,
            room.roomType.name,
            reservation?.code,
            reservation?.guest.firstName,
            reservation?.guest.lastName,
            `${reservation?.guest.firstName ?? ""} ${reservation?.guest.lastName ?? ""}`,
          ]
            .filter(Boolean)
            .join(" "),
        );
        return query.split(/\s+/).every((term) => haystack.includes(term));
      })
      .sort((a, b) => {
        const orderA = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const orderB = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.number.localeCompare(b.number, undefined, { numeric: true });
      });
  }, [boardQuery, boardStatusFilter, reservations, roomOrder, rooms, selectedFloor]);

  const boardKpis = useMemo(() => {
    const scopedRooms =
      selectedFloor === "all"
        ? rooms
        : rooms.filter((room) => (room.floor ?? "Sin piso") === selectedFloor);
    return getBoardKpis(scopedRooms, reservations);
  }, [reservations, rooms, selectedFloor]);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedReservation = selectedRoom
    ? reservations.find(
        (reservation) =>
          reservation.assignedRoom?.id === selectedRoom.id &&
          ACTIVE_ROOM_RESERVATION_STATUSES.includes(reservation.status),
      ) ?? null
    : null;

  useEffect(() => {
    if (!selectedReservation || !["confirmed", "assigned"].includes(selectedReservation.status)) {
      return;
    }

    setCheckInForm(buildCheckInForm(selectedReservation));
  }, [
    selectedReservation?.adults,
    selectedReservation?.children,
    selectedReservation?.occupants,
    selectedReservation?.guest.firstName,
    selectedReservation?.guest.lastName,
    selectedReservation?.guest.phone,
    selectedReservation?.id,
    selectedReservation?.status,
  ]);

  const selectedFlow = selectedRoom
    ? getRoomActionFlow(selectedRoom, selectedReservation, folio, folioLoading)
    : null;
  const selectedBalance = folio?.totals.balance ?? 0;
  const selectedCanCheckOut =
    selectedReservation?.status === "in_house" &&
    !folioLoading &&
    (!folio || selectedBalance <= 0.009);
  const selectedRoomReadyForCheckIn = selectedRoom ? isRoomReadyForCheckIn(selectedRoom) : false;
  const selectedCanEditCheckIn =
    Boolean(selectedReservation) &&
    ["confirmed", "assigned"].includes(selectedReservation?.status ?? "") &&
    selectedRoomReadyForCheckIn;
  const selectedRequiredOccupants = selectedReservation
    ? selectedReservation.adults + selectedReservation.children
    : 0;
  const selectedCompleteOccupants = selectedReservation
    ? countCompleteOccupants(selectedReservation.occupants ?? [])
    : 0;
  const selectedRoomingComplete =
    Boolean(selectedReservation) &&
    selectedRequiredOccupants > 0 &&
    selectedCompleteOccupants === selectedRequiredOccupants &&
    (selectedReservation?.occupants?.length ?? 0) === selectedRequiredOccupants;
  const selectedCanTransferReservation =
    Boolean(selectedReservation) &&
    ["pending", "confirmed", "assigned", "in_house"].includes(selectedReservation?.status ?? "");
  const showFolioCard =
    permissionsState.canViewFolio &&
    (selectedReservation?.status === "in_house" || folioLoading || Boolean(folio));

  useEffect(() => {
    if (roomView === "payments" && !showFolioCard) {
      setRoomView("detail");
      setRoomPanel(null);
    }
  }, [roomView, showFolioCard]);

  const selectedHistory = selectedRoom
    ? reservations.filter((reservation) => reservation.assignedRoom?.id === selectedRoom.id).slice(0, 4)
    : [];
  const selectedRoomCalendarDays = useMemo(() => daysForMonth(roomCalendarMonth), [roomCalendarMonth]);
  const selectedRoomCalendarReservations = selectedRoom
    ? reservations
        .filter(
          (reservation) =>
            reservation.assignedRoom?.id === selectedRoom.id &&
            ACTIVE_ROOM_RESERVATION_STATUSES.includes(reservation.status),
        )
        .sort(
          (a, b) =>
            parseDateInput(a.checkInDate.slice(0, 10)).getTime() -
            parseDateInput(b.checkInDate.slice(0, 10)).getTime(),
        )
    : [];
  const contextRoom = contextMenu ? rooms.find((room) => room.id === contextMenu.roomId) ?? null : null;
  const contextReservation = contextRoom
    ? reservations.find(
        (reservation) =>
          reservation.assignedRoom?.id === contextRoom.id &&
          ACTIVE_ROOM_RESERVATION_STATUSES.includes(reservation.status),
      ) ?? null
    : null;
  const contextFlow = contextRoom ? getRoomFlow(contextRoom, contextReservation) : null;
  const contextRoomReadyForCheckIn = contextRoom ? isRoomReadyForCheckIn(contextRoom) : false;
  const transferRooms =
    selectedRoom && selectedCanTransferReservation
      ? rooms.filter(
          (room) =>
            room.id !== selectedRoom.id &&
            room.roomType.id === selectedRoom.roomType.id &&
            room.commercialStatus === "available" &&
            room.cleaningStatus === "clean" &&
            room.maintenanceStatus === "ok",
        )
      : [];
  const formHasDepositAmount = Number(form.depositAmount || 0) > 0;
  const editableLayout = layoutMode && boardView === "map";
  const boardHeight = useMemo(() => {
    const positions = visibleRooms.map((room, index) =>
      getRoomPosition(room, index, selectedFloor, layout),
    );
    const maxY = positions.reduce((max, position) => Math.max(max, position.y), BOARD_PADDING);
    return Math.max(580, maxY + TILE_HEIGHT + BOARD_PADDING * 2);
  }, [layout, selectedFloor, visibleRooms]);

  async function createReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoom) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/reservations", {
        method: "POST",
        body: JSON.stringify({
          guest: {
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone || undefined,
          },
          roomTypeId: selectedRoom.roomType.id,
          assignedRoomId: selectedRoom.id,
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
          source: "direct",
          notes: form.notes || undefined,
        }),
      });
      setForm(initialReservationForm());
      setDrawerMode("info");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la reserva.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFolio(roomId: string) {
    setFolioLoading(true);
    try {
      const response = await apiFetch<{ folio: Folio | null }>(`/folios/by-room/${roomId}/active`);
      setFolio(response.folio);
    } finally {
      setFolioLoading(false);
    }
  }

  async function addCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!folio) return;
    setAccountSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Folio>(`/folios/${folio.id}/charges`, {
        method: "POST",
        body: JSON.stringify(chargeForm),
      });
      setFolio(updated);
      setChargeForm(initialChargeForm());
      setRoomPanel(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el cargo.");
    } finally {
      setAccountSaving(false);
    }
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!folio) return;
    setAccountSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Folio>(`/folios/${folio.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          ...paymentForm,
          currency: folio.currency,
          reference: paymentForm.reference || undefined,
        }),
      });
      setFolio(updated);
      setPaymentForm(initialPaymentForm());
      setRoomPanel(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago.");
    } finally {
      setAccountSaving(false);
    }
  }

  async function saveCheckInDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReservation) return;
    setCheckInSaving(true);
    setError(null);
    try {
      const saved = await apiFetch<Reservation>(`/reservations/${selectedReservation.id}/occupants`, {
        method: "PUT",
        body: JSON.stringify({
          adults: checkInForm.adults,
          children: checkInForm.children,
          occupants: normalizeOccupantForms(checkInForm.occupants),
        }),
      });
      setCheckInForm(buildCheckInForm(saved));
      await load();
      setRoomPanel(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la rooming list.");
    } finally {
      setCheckInSaving(false);
    }
  }

  async function transferSelectedReservation() {
    if (!selectedReservation || !transferRoomId) return;
    setError(null);
    try {
      await apiFetch(`/reservations/${selectedReservation.id}/transfer-room`, {
        method: "POST",
        body: JSON.stringify({
          roomId: transferRoomId,
          reason: "Cambio desde tablero de habitaciones",
        }),
      });
      setTransferRoomId("");
      await load();
      setRoomPanel(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la habitacion.");
    }
  }

  async function createInvoiceFromFolio() {
    if (!folio) return;
    setError(null);
    try {
      await apiFetch(`/invoices/from-folio/${folio.id}`, {
        method: "POST",
        body: JSON.stringify({ type: "invoice" }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo preparar la factura.");
    }
  }

  async function voidCharge(chargeId: string) {
    if (!folio) return;
    setAccountSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Folio>(`/folios/${folio.id}/charges/${chargeId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "Anulacion desde tablero" }),
      });
      setFolio(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo anular el cargo.");
    } finally {
      setAccountSaving(false);
    }
  }

  async function voidPayment(paymentId: string) {
    if (!folio) return;
    setAccountSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Folio>(`/folios/${folio.id}/payments/${paymentId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "Anulacion desde tablero" }),
      });
      setFolio(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo anular el pago.");
    } finally {
      setAccountSaving(false);
    }
  }

  async function runAction(reservation: Reservation, action: "confirm" | "cancel" | "check-in" | "check-out") {
    setError(null);
    try {
      await apiFetch(`/reservations/${reservation.id}/${action}`, {
        method: "POST",
        body: action === "cancel" ? JSON.stringify({ reason: "Accion desde tablero" }) : "{}",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la accion.");
    }
  }

  async function updateRoomStatus(key: string, value: string) {
    if (!selectedRoom) return;
    await updateRoomStatusForRoom(selectedRoom, key, value);
  }

  async function updateRoomStatusForRoom(room: Room, key: string, value: string) {
    setError(null);
    try {
      await apiFetch(`/rooms/${room.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value, reason: "Cambio desde tablero operativo" }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la habitacion.");
    }
  }

  function closeRoomDrawer() {
    setSelectedRoomId(null);
    setDrawerMode("info");
    setRoomPanel(null);
    setRoomView("detail");
  }

  function openRoom(roomId: string, mode: DrawerMode = "info") {
    setSelectedRoomId(roomId);
    setDrawerMode(mode);
    setRoomPanel(null);
    setRoomView("detail");
    setContextMenu(null);
  }

  function openReservationCalendar(roomId?: string) {
    const params = new URLSearchParams({
      start: toDateInput(new Date()),
    });
    if (roomId) params.set("roomId", roomId);
    window.location.assign(`/calendar?${params.toString()}`);
  }

  function scrollToAccount() {
    openRoomPanel("payment");
  }

  function changeRoomView(view: RoomDetailView) {
    setRoomView(view);
    setRoomPanel(null);
  }

  function openRoomPanel(panel: Exclude<RoomInlinePanel, null>) {
    if (panel === "charge" || panel === "payment") {
      setRoomView("payments");
    } else if (panel === "status") {
      setRoomView("operation");
    } else {
      setRoomView("detail");
    }
    setRoomPanel((current) => {
      return current === panel ? null : panel;
    });
  }

  function openHousekeeping() {
    window.location.assign("/housekeeping");
  }

  function openMaintenance() {
    window.location.assign("/maintenance");
  }

  function updateCheckInCount(key: "adults" | "children", value: string) {
    setCheckInForm((current) => resizeCheckInForm({ ...current, [key]: value }));
  }

  function updateOccupant(index: number, patch: Partial<ReservationOccupantForm>) {
    setCheckInForm((current) => ({
      ...current,
      occupants: current.occupants.map((occupant, itemIndex) =>
        itemIndex === index ? { ...occupant, ...patch } : occupant,
      ),
    }));
  }

  function markPrimaryOccupant(index: number) {
    setCheckInForm((current) => ({
      ...current,
      occupants: current.occupants.map((occupant, itemIndex) => ({
        ...occupant,
        primary: itemIndex === index,
      })),
    }));
  }

  function openRoomMenu(event: ReactMouseEvent<HTMLButtonElement>, room: Room) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedRoomId(null);
    setDrawerMode("info");
    setContextMenu({ roomId: room.id, x: event.clientX, y: event.clientY });
  }

  function startOrderDrag(event: ReactDragEvent<HTMLButtonElement>, room: Room) {
    if (boardView === "map") return;
    setContextMenu(null);
    orderDragRef.current = room.id;
    setDraggingOrderRoomId(room.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", room.id);
  }

  function dragOverOrderRoom(event: ReactDragEvent<HTMLButtonElement>, room: Room) {
    const sourceRoomId = orderDragRef.current;
    if (!sourceRoomId || sourceRoomId === room.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function dropOrderRoom(event: ReactDragEvent<HTMLButtonElement>, targetRoom: Room) {
    event.preventDefault();
    const sourceRoomId = orderDragRef.current ?? event.dataTransfer.getData("text/plain");
    if (!sourceRoomId || sourceRoomId === targetRoom.id) {
      finishOrderDrag();
      return;
    }
    reorderRooms(sourceRoomId, targetRoom.id);
    markDraggedRoom(sourceRoomId);
    finishOrderDrag();
  }

  function startOrderPointerDrag(event: PointerEvent<HTMLButtonElement>, room: Room) {
    if (event.button !== 0 || boardView === "map") return;
    setContextMenu(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    orderPointerDragRef.current = {
      roomId: room.id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };
    setDraggingOrderRoomId(room.id);
  }

  function moveOrderPointerDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = orderPointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.originX;
    const dy = event.clientY - drag.originY;
    if (Math.abs(dx) + Math.abs(dy) > 8) drag.moved = true;
  }

  function endOrderPointerDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = orderPointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    orderPointerDragRef.current = null;
    setDraggingOrderRoomId(null);
    if (!drag.moved) return;

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetButton =
      target instanceof HTMLElement ? target.closest<HTMLButtonElement>("[data-room-order-id]") : null;
    const targetRoomId = targetButton?.dataset.roomOrderId;
    if (targetRoomId && targetRoomId !== drag.roomId) {
      reorderRooms(drag.roomId, targetRoomId);
    }
    markDraggedRoom(drag.roomId);
  }

  function finishOrderDrag() {
    orderDragRef.current = null;
    setDraggingOrderRoomId(null);
  }

  function markDraggedRoom(roomId: string) {
    lastDraggedRoomRef.current = roomId;
    window.setTimeout(() => {
      if (lastDraggedRoomRef.current === roomId) lastDraggedRoomRef.current = null;
    }, 350);
  }

  function reorderRooms(sourceRoomId: string, targetRoomId: string) {
    setRoomOrder((current) => {
      const next = mergeRoomOrder(current, rooms);
      const sourceIndex = next.indexOf(sourceRoomId);
      const targetIndex = next.indexOf(targetRoomId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function resetFloorLayout() {
    setLayout((current) => {
      const next = { ...current };
      for (const room of visibleRooms) delete next[room.id];
      return next;
    });
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, room: Room, index: number) {
    if (event.button !== 0) return;
    if (!editableLayout) return;
    event.preventDefault();
    setContextMenu(null);
    setSelectedRoomId(null);
    setDrawerMode("info");
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = getRoomPosition(room, index, selectedFloor, layout);
    dragRef.current = {
      roomId: room.id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startX: position.x,
      startY: position.y,
      moved: false,
    };
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.originX;
    const dy = event.clientY - drag.originY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;

    const surfaceWidth = surfaceRef.current?.clientWidth ?? 900;
    const maxX = Math.max(BOARD_PADDING, surfaceWidth - TILE_WIDTH - BOARD_PADDING);
    const nextPoint = {
      x: clamp(snapToGrid(drag.startX + dx), BOARD_PADDING, maxX),
      y: Math.max(BOARD_PADDING, snapToGrid(drag.startY + dy)),
    };

    setLayout((current) => ({ ...current, [drag.roomId]: nextPoint }));
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      lastDraggedRoomRef.current = drag.roomId;
      window.setTimeout(() => {
        if (lastDraggedRoomRef.current === drag.roomId) lastDraggedRoomRef.current = null;
      }, 350);
    }
    dragRef.current = null;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Tablero de habitaciones</h1>
          <p>
            Vista operativa en tiempo real -{" "}
            {new Date().toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <div className="page-header-actions">
          <button onClick={() => load().catch((err) => setError(err.message))}>
            <RotateCcw size={15} />
            Actualizar
          </button>
          <button className="primary-button" onClick={() => openReservationCalendar(undefined)}>
            <CalendarPlus size={15} />
            Nueva reserva
          </button>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="board-kpi-bar" aria-label="Indicadores del tablero">
        <div className="board-kpi-card occupancy">
          <span>Ocupacion hoy</span>
          <strong>{boardKpis.occupancyRate}%</strong>
          <small>
            {boardKpis.occupied} de {boardKpis.total} hab.
          </small>
          <div className="board-kpi-progress">
            <span style={{ width: `${boardKpis.occupancyRate}%` }} />
          </div>
        </div>
        <div className="board-kpi-card">
          <span>Llegadas</span>
          <strong>{boardKpis.arrivals}</strong>
          <small>esperadas</small>
        </div>
        <div className="board-kpi-card">
          <span>Salidas</span>
          <strong>{boardKpis.departures}</strong>
          <small>pendientes</small>
        </div>
        <div className="board-kpi-card">
          <span>Por limpiar</span>
          <strong>{boardKpis.toClean}</strong>
          <small>habitaciones</small>
        </div>
        <div className="board-kpi-card">
          <span>Fuera servicio</span>
          <strong>{boardKpis.outOfService}</strong>
          <small>habitaciones</small>
        </div>
      </section>

      <section className="board-filter-bar" aria-label="Filtros del tablero">
        <div className="floor-tabs">
          <button
            className={selectedFloor === "all" ? "active" : ""}
            onClick={() => setSelectedFloor("all")}
          >
            Todos <span>{rooms.length}</span>
          </button>
          {floors.map((floor) => (
            <button
              key={floor}
              className={selectedFloor === floor ? "active" : ""}
              onClick={() => setSelectedFloor(floor)}
            >
              Piso {floor}{" "}
              <span>{rooms.filter((room) => (room.floor ?? "Sin piso") === floor).length}</span>
            </button>
          ))}
        </div>
        <label className="board-search">
          <Search size={15} />
          <input
            value={boardQuery}
            onChange={(event) => setBoardQuery(event.target.value)}
            placeholder="Buscar hab. o huesped"
          />
        </label>
        <div className="board-view-switch" aria-label="Vista del tablero">
          {BOARD_VIEW_OPTIONS.map((option) => (
            <button
              className={boardView === option.key ? "active" : ""}
              key={option.key}
              onClick={() => setBoardView(option.key)}
              type="button"
            >
              {option.key === "map" ? <MapIcon size={15} /> : null}
              {option.key === "grid" ? <LayoutGrid size={15} /> : null}
              {option.key === "list" ? <List size={15} /> : null}
              {option.label}
            </button>
          ))}
        </div>
        <div className="layout-actions">
          <button
            className={layoutMode ? "active" : ""}
            disabled={boardView !== "map"}
            onClick={() => setLayoutMode((current) => !current)}
            title="Editar plano"
          >
            <Move size={16} />
            {layoutMode ? "Listo" : "Plano"}
          </button>
          <button disabled={boardView !== "map"} onClick={resetFloorLayout} title="Restablecer piso">
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </section>

      <section className="board-status-filters" aria-label="Filtros por estado">
        <span>Estado</span>
        {BOARD_STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            className={boardStatusFilter === filter.key ? "active" : ""}
            data-status={filter.key}
            onClick={() =>
              setBoardStatusFilter((current) => (current === filter.key ? "all" : filter.key))
            }
          >
            <i />
            {filter.label}
          </button>
        ))}
        {boardStatusFilter !== "all" || boardQuery ? (
          <button className="clear-filter" onClick={() => {
            setBoardStatusFilter("all");
            setBoardQuery("");
          }}>
            Limpiar
          </button>
        ) : null}
      </section>

      <section className="room-board-layout">
        {visibleRooms.length === 0 ? (
          <div className="panel empty-state board-empty-state">
            No hay habitaciones que coincidan con los filtros.
          </div>
        ) : null}
        {boardView === "map" ? (
          <div
            className={`room-board-surface ${editableLayout ? "editing" : ""}`}
            aria-label="Mapa de habitaciones"
            ref={surfaceRef}
            style={{ minHeight: boardHeight }}
          >
            {visibleRooms.map((room, index) => {
              const reservation = activeReservationForRoom(room, reservations);
              const isSelected = room.id === selectedRoom?.id;
              const position = getRoomPosition(room, index, selectedFloor, layout);
              return (
                <button
                  key={room.id}
                  className={`room-tile ${roomTone(room, reservation)} ${isSelected ? "selected" : ""} ${
                    editableLayout ? "layout-editing" : ""
                  }`}
                  style={{ left: position.x, top: position.y }}
                  onPointerDown={(event) => startDrag(event, room, index)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onContextMenu={(event) => openRoomMenu(event, room)}
                  onClick={() => {
                    if (editableLayout) return;
                    if (lastDraggedRoomRef.current === room.id) return;
                    openRoom(room.id);
                  }}
                  type="button"
                >
                  <span className="room-tile-top">
                    <span>
                      <strong>{room.number}</strong>
                      <small>{room.roomType.code}</small>
                    </span>
                    <span className="room-status-dot" />
                  </span>
                  <span className="room-tile-status">{getBoardStatusLabel(room, reservation)}</span>
                  <span className="room-tile-primary">{getRoomTilePrimary(room, reservation)}</span>
                  <span className="room-tile-secondary">{getRoomTileSecondary(room, reservation)}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {boardView === "grid" ? (
          <div className="room-grid-view" aria-label="Grilla de habitaciones">
            {visibleRooms.map((room) => {
              const reservation = activeReservationForRoom(room, reservations);
              const isSelected = room.id === selectedRoom?.id;
              return (
                <button
                  className={`room-tile room-grid-card ${roomTone(room, reservation)} ${
                    isSelected ? "selected" : ""
                  } ${draggingOrderRoomId === room.id ? "order-dragging" : ""}`}
                  data-room-order-id={room.id}
                  draggable={false}
                  key={room.id}
                  onClick={() => {
                    if (lastDraggedRoomRef.current === room.id) return;
                    openRoom(room.id);
                  }}
                  onContextMenu={(event) => openRoomMenu(event, room)}
                  onDragEnd={finishOrderDrag}
                  onDragOver={(event) => dragOverOrderRoom(event, room)}
                  onDragStart={(event) => startOrderDrag(event, room)}
                  onDrop={(event) => dropOrderRoom(event, room)}
                  onPointerCancel={endOrderPointerDrag}
                  onPointerDown={(event) => startOrderPointerDrag(event, room)}
                  onPointerMove={moveOrderPointerDrag}
                  onPointerUp={endOrderPointerDrag}
                  type="button"
                >
                  <span className="room-tile-top">
                    <span>
                      <strong>{room.number}</strong>
                      <small>{room.roomType.code}</small>
                    </span>
                    <span className="room-status-dot" />
                  </span>
                  <span className="room-tile-status">{getBoardStatusLabel(room, reservation)}</span>
                  <span className="room-tile-primary">{getRoomTilePrimary(room, reservation)}</span>
                  <span className="room-tile-secondary">{getRoomTileSecondary(room, reservation)}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {boardView === "list" ? (
          <div className="room-list-view" aria-label="Lista de habitaciones">
            <div className="room-list-header" aria-hidden="true">
              <span>Habitacion</span>
              <span>Estado</span>
              <span>Huesped / reserva</span>
              <span>Limpieza</span>
              <span>Mantenimiento</span>
              <span>Fechas</span>
            </div>
            {visibleRooms.map((room) => {
              const reservation = activeReservationForRoom(room, reservations);
              const isSelected = room.id === selectedRoom?.id;
              return (
                <button
                  className={`room-list-row ${roomTone(room, reservation)} ${
                    isSelected ? "selected" : ""
                  } ${draggingOrderRoomId === room.id ? "order-dragging" : ""}`}
                  data-room-order-id={room.id}
                  draggable={false}
                  key={room.id}
                  onClick={() => {
                    if (lastDraggedRoomRef.current === room.id) return;
                    openRoom(room.id);
                  }}
                  onContextMenu={(event) => openRoomMenu(event, room)}
                  onDragEnd={finishOrderDrag}
                  onDragOver={(event) => dragOverOrderRoom(event, room)}
                  onDragStart={(event) => startOrderDrag(event, room)}
                  onDrop={(event) => dropOrderRoom(event, room)}
                  onPointerCancel={endOrderPointerDrag}
                  onPointerDown={(event) => startOrderPointerDrag(event, room)}
                  onPointerMove={moveOrderPointerDrag}
                  onPointerUp={endOrderPointerDrag}
                  type="button"
                >
                  <span className="room-list-main">
                    <strong>{room.number}</strong>
                    <small>
                      {room.roomType.code} - Piso {room.floor ?? "-"}
                    </small>
                  </span>
                  <span>
                    <strong>{getBoardStatusLabel(room, reservation)}</strong>
                    <small>{statusLabels[room.commercialStatus] ?? room.commercialStatus}</small>
                  </span>
                  <span>
                    <strong>{reservation ? getRoomTilePrimary(room, reservation) : "-"}</strong>
                    <small>{reservation?.code ?? getRoomTileSecondary(room, reservation)}</small>
                  </span>
                  <span>
                    <strong>{statusLabels[room.cleaningStatus] ?? room.cleaningStatus}</strong>
                    <small>{room.capacity} pax</small>
                  </span>
                  <span>
                    <strong>{statusLabels[room.maintenanceStatus] ?? room.maintenanceStatus}</strong>
                    <small>{room.block ?? "Sin bloque"}</small>
                  </span>
                  <span>
                    <strong>
                      {reservation
                        ? `${formatDateShort(reservation.checkInDate)} - ${formatDateShort(
                            reservation.checkOutDate,
                          )}`
                        : "Sin reserva"}
                    </strong>
                    <small>
                      {reservation ? `${reservation.adults + reservation.children} pax` : room.roomType.name}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {selectedRoom ? (
          <>
            <button
              className="drawer-backdrop"
              aria-label="Cerrar ficha"
              onClick={closeRoomDrawer}
            />
            <aside
              className="panel room-detail-panel"
              role="dialog"
              aria-label={`Habitacion ${selectedRoom.number}`}
            >
              <div className="drawer-header">
                <button className="drawer-close" onClick={closeRoomDrawer}>
                  <X size={16} />
                  Volver
                </button>
                <div className="detail-header">
                  <div>
                    <span className="detail-kicker">Habitacion</span>
                    <h2>{selectedRoom.number}</h2>
                    <p>
                      {selectedRoom.roomType.name} - Piso {selectedRoom.floor ?? "-"} -{" "}
                      {selectedRoom.block ?? "Sin bloque"}
                    </p>
                  </div>
                  <StatusBadge value={selectedRoom.commercialStatus} />
                </div>

                <nav className="drawer-section-tabs" aria-label="Secciones de habitacion">
                  <button
                    type="button"
                    className={roomView === "detail" ? "active" : ""}
                    onClick={() => changeRoomView("detail")}
                  >
                    Detalle
                  </button>
                  <button
                    type="button"
                    className={roomView === "payments" ? "active" : ""}
                    disabled={!showFolioCard}
                    onClick={() => changeRoomView("payments")}
                  >
                    Pagos
                  </button>
                  <button
                    type="button"
                    className={roomView === "operation" ? "active" : ""}
                    onClick={() => changeRoomView("operation")}
                  >
                    Operacion
                  </button>
                  <button
                    type="button"
                    className={roomView === "movements" ? "active" : ""}
                    onClick={() => changeRoomView("movements")}
                  >
                    Movimientos
                  </button>
                  <button
                    type="button"
                    className={roomView === "calendar" ? "active" : ""}
                    onClick={() => changeRoomView("calendar")}
                  >
                    Calendario
                  </button>
                </nav>
              </div>

              <div className={`room-detail-grid view-${roomView}`}>
                <div className="room-detail-main">

              {selectedFlow ? (
                <section className={`room-action-flow detail-view-block ${selectedFlow.tone}`}>
                  <div>
                    <span className="detail-kicker">Siguiente accion</span>
                    <h3>{selectedFlow.title}</h3>
                    <p>{selectedFlow.description}</p>
                  </div>
                  <div className="actions">
                    {selectedFlow.kind === "create_reservation" ? (
                      <button
                        className="primary-button"
                        disabled={!permissionsState.canCreate}
                        onClick={() => openReservationCalendar(selectedRoom.id)}
                      >
                        <CalendarPlus size={15} />
                        Elegir fechas
                      </button>
                    ) : null}
                    {selectedFlow.kind === "confirm_reservation" && selectedReservation ? (
                      <button
                        className="primary-button"
                        disabled={!permissionsState.canUpdate}
                        onClick={() => runAction(selectedReservation, "confirm")}
                      >
                        <Check size={15} />
                        Confirmar reserva
                      </button>
                    ) : null}
                    {selectedFlow.kind === "check_in" && selectedReservation ? (
                      selectedRoomingComplete ? (
                        <button
                          className="primary-button"
                          disabled={!permissionsState.canCheckIn}
                          onClick={() => runAction(selectedReservation, "check-in")}
                        >
                          <DoorOpen size={15} />
                          Hacer check-in
                        </button>
                      ) : (
                        <button
                          className="primary-button"
                          disabled={!permissionsState.canUpdate}
                          onClick={() => openRoomPanel("check_in")}
                        >
                          <UserRound size={15} />
                          Completar huespedes
                        </button>
                      )
                    ) : null}
                    {selectedFlow.kind === "settle_account" ? (
                      <>
                        <button
                          className="primary-button"
                          disabled={!permissionsState.canViewFolio}
                          onClick={scrollToAccount}
                        >
                          <CreditCard size={15} />
                          Registrar pago
                        </button>
                        {folio ? (
                          <button
                            disabled={!permissionsState.canCreateInvoice}
                            onClick={createInvoiceFromFolio}
                          >
                            <ReceiptText size={15} />
                            Preparar factura
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {selectedFlow.kind === "ready_check_out" && selectedReservation ? (
                      <>
                        {folio ? (
                          <button
                            disabled={!permissionsState.canCreateInvoice}
                            onClick={createInvoiceFromFolio}
                          >
                            <ReceiptText size={15} />
                            Preparar factura
                          </button>
                        ) : null}
                        <button
                          className="primary-button"
                          disabled={!permissionsState.canCheckOut || !selectedCanCheckOut}
                          onClick={() => runAction(selectedReservation, "check-out")}
                        >
                          <DoorOpen size={15} />
                          Check-out
                        </button>
                      </>
                    ) : null}
                    {selectedFlow.kind === "housekeeping" ? (
                      <button className="primary-button" onClick={openHousekeeping}>
                        <Sparkles size={15} />
                        Ver housekeeping
                      </button>
                    ) : null}
                    {selectedFlow.kind === "maintenance" ? (
                      <button className="primary-button" onClick={openMaintenance}>
                        <Wrench size={15} />
                        Ver mantenimiento
                      </button>
                    ) : null}
                    {selectedFlow.kind === "account_loading" ? (
                      <button disabled>
                        <Wallet size={15} />
                        Cargando cuenta
                      </button>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <div className="detail-status-grid detail-status-grid-inline detail-view-block" id="room-detail-section">
                <StatusLine icon={<DoorOpen size={16} />} label="Venta" value={selectedRoom.commercialStatus} />
                <StatusLine icon={<Sparkles size={16} />} label="Limpieza" value={selectedRoom.cleaningStatus} />
                <StatusLine icon={<Wrench size={16} />} label="Mantenimiento" value={selectedRoom.maintenanceStatus} />
                <StatusLine icon={<UserRound size={16} />} label="Capacidad" value={`${selectedRoom.capacity} pax`} />
              </div>

              <RoomCapabilityPanel
                className="detail-view-block"
                title="Detalle operativo"
                items={[
                  "Reserva, huespedes, capacidad, estado comercial y proxima accion",
                  "Rooming list antes del check-in y cambio de habitacion si corresponde",
                  "Para crear una reserva nueva se abre el calendario y se eligen fechas",
                ]}
              />

              {selectedReservation ? (
                <section className="active-stay-box detail-view-block">
                  <div>
                    <span className="detail-kicker">Reserva / huesped</span>
                    <h3>{selectedReservation.code}</h3>
                    <p>
                      {selectedReservation.guest.lastName}, {selectedReservation.guest.firstName}
                    </p>
                    <p>
                      {formatDate(selectedReservation.checkInDate)} -{" "}
                      {formatDate(selectedReservation.checkOutDate)}
                    </p>
                    {Number(selectedReservation.depositAmount ?? 0) > 0 ? (
                      <p>
                        Sena{" "}
                        {formatMoney(
                          Number(selectedReservation.depositAmount),
                          selectedReservation.currency,
                        )}{" "}
                        -{" "}
                        {selectedReservation.depositPaid ? "pagada" : "pendiente"}
                        {selectedReservation.depositPaid && selectedReservation.depositMethod
                          ? ` (${paymentMethodLabels[selectedReservation.depositMethod]})`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="actions">
                    {selectedCanEditCheckIn ? (
                      <button
                        type="button"
                        onClick={() => openRoomPanel("check_in")}
                      >
                        <UserRound size={15} />
                        Editar huespedes
                      </button>
                    ) : null}
                    {selectedCanTransferReservation ? (
                      <button
                        type="button"
                        disabled={!permissionsState.canTransferRoom || transferRooms.length === 0}
                        onClick={() => openRoomPanel("transfer")}
                      >
                        <Move size={15} />
                        Cambiar habitacion
                      </button>
                    ) : null}
                  </div>
                  {["confirmed", "assigned"].includes(selectedReservation.status) ? (
                    <div className="rooming-summary">
                      <div>
                        <span>Rooming list</span>
                        <strong>
                          {selectedCompleteOccupants}/{selectedRequiredOccupants} personas completas
                        </strong>
                        <small>
                          {selectedReservation.adults} adultos / {selectedReservation.children} menores
                        </small>
                      </div>
                      <span className={`badge ${selectedRoomingComplete ? "" : "warn"}`}>
                        {selectedRoomingComplete ? "Completa" : "Pendiente"}
                      </span>
                    </div>
                  ) : null}
                  {!selectedRoomReadyForCheckIn &&
                  ["confirmed", "assigned"].includes(selectedReservation.status) ? (
                    <p className="muted-text">
                      Ingreso bloqueado: la habitacion debe estar disponible, limpia y sin
                      mantenimiento pendiente. Cambia la reserva de habitacion o resuelve el estado
                      operativo.
                    </p>
                  ) : null}
                  {roomPanel === "check_in" && selectedCanEditCheckIn ? (
                    <form
                      className="inline-action-card rooming-list-card"
                      id="room-action-panel"
                      onSubmit={saveCheckInDetails}
                    >
                      <div className="mini-form-title">
                        <UserRound size={18} />
                        <h3>Rooming list</h3>
                      </div>
                      <p className="muted-text">
                        Registra cada persona que dormira en la habitacion antes del check-in.
                      </p>
                      <div className="form-grid two">
                        <label>
                          Adultos
                          <input
                            required
                            min="1"
                            type="number"
                            value={checkInForm.adults}
                            onChange={(event) =>
                              updateCheckInCount("adults", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          Menores
                          <input
                            min="0"
                            type="number"
                            value={checkInForm.children}
                            onChange={(event) =>
                              updateCheckInCount("children", event.target.value)
                            }
                          />
                        </label>
                      </div>
                      <div className="occupant-list">
                        {checkInForm.occupants.map((occupant, index) => (
                          <div className="occupant-card" key={`${occupant.ageCategory}-${index}`}>
                            <div className="occupant-card-header">
                              <div>
                                <span>{occupantLabel(occupant, index, checkInForm.occupants)}</span>
                                <strong>
                                  {occupant.primary ? "Titular" : `Huesped ${index + 1}`}
                                </strong>
                              </div>
                              <label className="checkbox-line">
                                <input
                                  type="radio"
                                  name="primary-occupant"
                                  checked={occupant.primary}
                                  onChange={() => markPrimaryOccupant(index)}
                                />
                                Titular
                              </label>
                            </div>
                            <div className="form-grid two">
                              <label>
                                Nombre
                                <input
                                  required
                                  value={occupant.firstName}
                                  onChange={(event) =>
                                    updateOccupant(index, { firstName: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Apellido
                                <input
                                  required
                                  value={occupant.lastName}
                                  onChange={(event) =>
                                    updateOccupant(index, { lastName: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Tipo doc.
                                <input
                                  value={occupant.documentType}
                                  onChange={(event) =>
                                    updateOccupant(index, { documentType: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Documento
                                <input
                                  value={occupant.documentNumber}
                                  onChange={(event) =>
                                    updateOccupant(index, { documentNumber: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Telefono
                                <input
                                  value={occupant.phone}
                                  onChange={(event) =>
                                    updateOccupant(index, { phone: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Nacionalidad
                                <input
                                  value={occupant.nationality}
                                  onChange={(event) =>
                                    updateOccupant(index, { nationality: event.target.value })
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        className="primary-button"
                        disabled={!permissionsState.canUpdate || checkInSaving}
                      >
                        {checkInSaving ? "Guardando..." : "Guardar rooming list"}
                      </button>
                    </form>
                  ) : null}
                  {roomPanel === "transfer" && selectedCanTransferReservation ? (
                    <div className="inline-action-card" id="room-action-panel">
                      <div className="mini-form-title">
                        <Move size={18} />
                        <h3>Cambiar habitacion</h3>
                      </div>
                      <div className="inline-control-row">
                      <select
                        value={transferRoomId}
                        onChange={(event) => setTransferRoomId(event.target.value)}
                      >
                        <option value="">Cambiar a...</option>
                        {transferRooms.map((room) => (
                          <option value={room.id} key={room.id}>
                            Hab. {room.number}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!permissionsState.canTransferRoom || !transferRoomId}
                        onClick={transferSelectedReservation}
                      >
                        Cambiar habitacion
                      </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : drawerMode === "reservation" ? (
                <form className="reservation-mini-form detail-view-block" onSubmit={createReservation}>
                  <div className="mini-form-title">
                    <CalendarPlus size={18} />
                    <h3>Crear reserva</h3>
                  </div>
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
                    <label className="wide">
                      Telefono
                      <input
                        value={form.phone}
                        onChange={(event) => setForm({ ...form, phone: event.target.value })}
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
                            depositPaid:
                              Number(depositAmount || 0) > 0 ? form.depositPaid : false,
                          });
                        }}
                      />
                    </label>
                    <label className="checkbox-line wide">
                      <input
                        type="checkbox"
                        checked={form.depositPaid}
                        disabled={!formHasDepositAmount}
                        onChange={(event) =>
                          setForm({ ...form, depositPaid: event.target.checked })
                        }
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
                            onChange={(event) =>
                              setForm({ ...form, depositReference: event.target.value })
                            }
                          />
                        </label>
                      </>
                    ) : null}
                    <label className="wide">
                      Notas
                      <input
                        value={form.notes}
                        onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      />
                    </label>
                  </div>
                  <button className="primary-button" disabled={!permissionsState.canCreate || loading}>
                    {loading ? "Guardando..." : "Reservar habitacion"}
                  </button>
                </form>
              ) : (
                <section className="active-stay-box detail-view-block">
                  <div>
                    <span className="detail-kicker">Reserva</span>
                    <h3>Sin reserva activa</h3>
                    <p>La habitacion esta libre. Para reservar, usa la accion principal de arriba.</p>
                  </div>
                </section>
              )}

              {showFolioCard ? (
                <>
                  <section className="folio-section payments-view-block" id="room-account-section">
                    <div className="section-title-row">
                      <div>
                        <span className="detail-kicker">Cuenta</span>
                        <h3>Folio de habitacion</h3>
                      </div>
                      {folio ? <span className="badge">{folio.status === "open" ? "Abierta" : "Cerrada"}</span> : null}
                    </div>
                    {folioLoading ? (
                      <p className="muted-text">Cargando cuenta...</p>
                    ) : folio ? (
                      <>
                        <div className="folio-totals">
                          <div>
                            <span>Cargos</span>
                            <strong>{formatMoney(folio.totals.charges, folio.currency)}</strong>
                          </div>
                          <div>
                            <span>Pagos</span>
                            <strong>{formatMoney(folio.totals.payments, folio.currency)}</strong>
                          </div>
                          <div className={folio.totals.balance > 0 ? "balance-due" : "balance-ok"}>
                            <span>Saldo</span>
                            <strong>{formatMoney(folio.totals.balance, folio.currency)}</strong>
                          </div>
                        </div>
                        <div className="actions">
                          <button
                            disabled={!permissionsState.canCreateInvoice}
                            onClick={createInvoiceFromFolio}
                          >
                            <ReceiptText size={15} />
                            Preparar factura
                          </button>
                          {folio.status === "open" ? (
                            <>
                              <button
                                type="button"
                                disabled={!permissionsState.canCreateCharge}
                                onClick={() => openRoomPanel("charge")}
                              >
                                <PlusCircle size={15} />
                                Agregar cargo
                              </button>
                              <button
                                type="button"
                                disabled={!permissionsState.canCreatePayment}
                                onClick={() => openRoomPanel("payment")}
                              >
                                <CreditCard size={15} />
                                Registrar pago
                              </button>
                            </>
                          ) : null}
                        </div>

                        <RoomCapabilityPanel
                          title="Cuenta modificable"
                          items={[
                            "Cargos de alojamiento, extras, frigobar, lavanderia, spa, eventos y ajustes",
                            "Pagos en efectivo, tarjeta, transferencia o cuenta corriente",
                            "Anulaciones, comprobantes y factura AFIP solo con permisos",
                          ]}
                        />

                        <div className="folio-list">
                          <div className="folio-list-title">
                            <ReceiptText size={16} />
                            <strong>Cargos</strong>
                          </div>
                          {folio.charges.length ? (
                            folio.charges.map((charge) => (
                              <div className="folio-row" key={charge.id}>
                                <div>
                                  <span>{chargeKindLabels[charge.kind]}</span>
                                  <strong>{charge.description}</strong>
                                </div>
                                <span className="folio-row-actions">
                                  <em>{formatMoney(charge.totalAmount, folio.currency)}</em>
                                  {permissionsState.canVoidCharge ? (
                                    <button
                                      type="button"
                                      disabled={accountSaving}
                                      onClick={() => voidCharge(charge.id)}
                                    >
                                      <RotateCcw size={13} />
                                      Anular
                                    </button>
                                  ) : null}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="muted-text">Sin cargos registrados.</p>
                          )}
                        </div>

                        <div className="folio-list">
                          <div className="folio-list-title">
                            <Wallet size={16} />
                            <strong>Pagos</strong>
                          </div>
                          {folio.payments.length ? (
                            folio.payments.map((payment) => (
                              <div className="folio-row" key={payment.id}>
                                <div>
                                  <span>{paymentMethodLabels[payment.method]}</span>
                                  <strong>{payment.reference || formatDate(payment.paidAt)}</strong>
                                </div>
                                <span className="folio-row-actions">
                                  <em>{formatMoney(payment.amount, payment.currency)}</em>
                                  {permissionsState.canVoidPayment ? (
                                    <button
                                      type="button"
                                      disabled={accountSaving}
                                      onClick={() => voidPayment(payment.id)}
                                    >
                                      <RotateCcw size={13} />
                                      Anular
                                    </button>
                                  ) : null}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="muted-text">Sin pagos registrados.</p>
                          )}
                        </div>

                        {folio.status === "open" && roomPanel === "charge" ? (
                          <form
                            className="inline-action-card account-mini-form"
                            id="room-action-panel"
                            onSubmit={addCharge}
                          >
                            <div className="mini-form-title">
                              <PlusCircle size={18} />
                              <h3>Cargo rapido</h3>
                            </div>
                            <div className="form-grid two">
                              <label>
                                Tipo
                                <select
                                  value={chargeForm.kind}
                                  onChange={(event) =>
                                    setChargeForm({
                                      ...chargeForm,
                                      kind: event.target.value as ChargeKind,
                                    })
                                  }
                                >
                                  {chargeKinds.map((kind) => (
                                    <option value={kind} key={kind}>
                                      {chargeKindLabels[kind]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Importe
                                <input
                                  required
                                  min="1"
                                  type="number"
                                  value={chargeForm.unitAmount}
                                  onChange={(event) =>
                                    setChargeForm({ ...chargeForm, unitAmount: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Cantidad
                                <input
                                  required
                                  min="1"
                                  type="number"
                                  value={chargeForm.quantity}
                                  onChange={(event) =>
                                    setChargeForm({ ...chargeForm, quantity: event.target.value })
                                  }
                                />
                              </label>
                              <label className="wide">
                                Detalle
                                <input
                                  required
                                  value={chargeForm.description}
                                  onChange={(event) =>
                                    setChargeForm({ ...chargeForm, description: event.target.value })
                                  }
                                />
                              </label>
                            </div>
                            <button
                              className="primary-button"
                              disabled={!permissionsState.canCreateCharge || accountSaving}
                            >
                              Cargar cargo
                            </button>
                          </form>
                        ) : null}

                        {folio.status === "open" && roomPanel === "payment" ? (
                          <form
                            className="inline-action-card account-mini-form"
                            id="room-action-panel"
                            onSubmit={addPayment}
                          >
                            <div className="mini-form-title">
                              <CreditCard size={18} />
                              <h3>Registrar pago</h3>
                            </div>
                            <div className="form-grid two">
                              <label>
                                Medio
                                <select
                                  value={paymentForm.method}
                                  onChange={(event) =>
                                    setPaymentForm({
                                      ...paymentForm,
                                      method: event.target.value as PaymentMethod,
                                    })
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
                                Importe
                                <input
                                  required
                                  min="1"
                                  type="number"
                                  value={paymentForm.amount}
                                  onChange={(event) =>
                                    setPaymentForm({ ...paymentForm, amount: event.target.value })
                                  }
                                />
                              </label>
                              <label className="wide">
                                Referencia
                                <input
                                  value={paymentForm.reference}
                                  onChange={(event) =>
                                    setPaymentForm({ ...paymentForm, reference: event.target.value })
                                  }
                                />
                              </label>
                            </div>
                            <button
                              className="primary-button"
                              disabled={!permissionsState.canCreatePayment || accountSaving}
                            >
                              Registrar pago
                            </button>
                          </form>
                        ) : null}
                      </>
                    ) : (
                      <p className="muted-text">Sin cuenta abierta. La cuenta se abre automaticamente al hacer check-in.</p>
                    )}
                  </section>
                </>
              ) : null}

                </div>
                <div className="room-detail-side">
                  <section className="quick-facts operation-view-block">
                    <div className="section-title-row">
                      <div>
                        <span className="detail-kicker">Resumen</span>
                        <h3>Datos rapidos</h3>
                      </div>
                    </div>
                    <div className="quick-fact-grid">
                      <div>
                        <span>Flujo</span>
                        <strong>{selectedFlow?.title ?? "Sin accion"}</strong>
                      </div>
                      <div>
                        <span>Reserva</span>
                        <strong>
                          {selectedReservation
                            ? statusLabels[selectedReservation.status] ?? selectedReservation.status
                            : "Sin reserva"}
                        </strong>
                      </div>
                      <div>
                        <span>Cuenta</span>
                        <strong>
                          {folioLoading
                            ? "Cargando"
                            : folio
                              ? folio.totals.balance > 0
                                ? "Saldo pendiente"
                                : "Sin saldo"
                              : "Sin folio"}
                        </strong>
                      </div>
                      <div>
                        <span>{selectedReservation?.status === "in_house" ? "Pax" : "Rooming"}</span>
                        <strong>
                          {selectedReservation
                            ? selectedReservation.status === "in_house"
                              ? `${selectedReservation.adults + selectedReservation.children} pax`
                              : `${selectedCompleteOccupants}/${selectedRequiredOccupants}`
                            : "-"}
                        </strong>
                      </div>
                    </div>
                  </section>

              <section className="room-status-editor operation-view-block" id="room-operation-section">
                <div className="section-title-row">
                  <div>
                    <span className="detail-kicker">Operacion interna</span>
                    <h3>Estados internos</h3>
                  </div>
                  <button
                    type="button"
                    disabled={!permissionsState.canUpdateRoom}
                    onClick={() => openRoomPanel("status")}
                  >
                    <Wrench size={15} />
                    Cambiar estados
                  </button>
                </div>
                {roomPanel === "status" ? (
                  <div className="inline-action-card status-action-grid" id="room-action-panel">
                    <StatusSelect
                      label="Venta"
                      value={selectedRoom.commercialStatus}
                      values={commercialStatuses}
                      disabled={!permissionsState.canUpdateRoom}
                      onChange={(value) => updateRoomStatus("commercialStatus", value)}
                    />
                    <StatusSelect
                      label="Limpieza"
                      value={selectedRoom.cleaningStatus}
                      values={cleaningStatuses}
                      disabled={!permissionsState.canUpdateRoom}
                      onChange={(value) => updateRoomStatus("cleaningStatus", value)}
                    />
                    <StatusSelect
                      label="Mantenimiento"
                      value={selectedRoom.maintenanceStatus}
                      values={maintenanceStatuses}
                      disabled={!permissionsState.canUpdateRoom}
                      onChange={(value) => updateRoomStatus("maintenanceStatus", value)}
                    />
                  </div>
                ) : null}
                <RoomCapabilityPanel
                  title="Operacion modificable"
                  items={[
                    "Venta: disponible, ocupada, bloqueada o fuera de servicio",
                    "Limpieza: sucia, en limpieza, inspeccion o limpia",
                    "Mantenimiento: OK, pendiente o fuera de servicio",
                  ]}
                />
              </section>

              <section className="room-history movements-view-block" id="room-movements-section">
                <h3>Movimientos</h3>
                {selectedHistory.length ? (
                  selectedHistory.map((reservation) => (
                    <div key={reservation.id} className="history-row">
                      <span>{reservation.code}</span>
                      <strong>{statusLabels[reservation.status] ?? reservation.status}</strong>
                    </div>
                  ))
                ) : (
                  <p>Sin movimientos recientes.</p>
                )}
                <RoomCapabilityPanel
                  title="Historial"
                  items={[
                    "Reservas anteriores y activas de esta habitacion",
                    "Cambios de habitacion, check-in, check-out y movimientos de cuenta",
                    "Esta vista debe ser principalmente de lectura y auditoria",
                  ]}
                />
              </section>

              <section className="room-calendar-view calendar-view-block">
                <div className="section-title-row">
                  <div>
                    <span className="detail-kicker">Calendario</span>
                    <h3>Habitacion {selectedRoom.number}</h3>
                  </div>
                  <div className="room-calendar-controls">
                    <button
                      type="button"
                      onClick={() => setRoomCalendarMonth(addMonthsToInput(roomCalendarMonth, -1))}
                    >
                      Anterior
                    </button>
                    <input
                      aria-label="Mes de calendario"
                      type="month"
                      value={roomCalendarMonth}
                      onChange={(event) => setRoomCalendarMonth(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setRoomCalendarMonth(addMonthsToInput(roomCalendarMonth, 1))}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>

                <div className="room-calendar-grid">
                  {selectedRoomCalendarDays.map((day) => {
                    const reservation = selectedRoomCalendarReservations.find((item) =>
                      reservationCoversDay(item, day),
                    );
                    const today = toDateInput(day) === toDateInput(new Date());
                    return (
                      <div
                        className={`room-calendar-day ${reservation ? "booked" : ""} ${today ? "today" : ""}`}
                        key={day.toISOString()}
                      >
                        <span>{formatDayShort(day)}</span>
                        {reservation ? (
                          <>
                            <strong>{reservation.guest.lastName}</strong>
                            <small>{statusLabels[reservation.status] ?? reservation.status}</small>
                          </>
                        ) : (
                          <small>Libre</small>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="room-calendar-list">
                  <div className="folio-list-title">
                    <CalendarDays size={16} />
                    <strong>Reservas del periodo</strong>
                  </div>
                  {selectedRoomCalendarReservations.length ? (
                    selectedRoomCalendarReservations.map((reservation) => (
                      <div className="history-row" key={reservation.id}>
                        <span>
                          {reservation.code} - {reservation.guest.lastName}
                        </span>
                        <strong>
                          {formatDate(reservation.checkInDate)} - {formatDate(reservation.checkOutDate)}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted-text">Sin reservas activas para esta habitacion.</p>
                  )}
                </div>
                <RoomCapabilityPanel
                  title="Calendario operativo"
                  items={[
                    "Ver ocupacion futura de la habitacion",
                    "Mover reservas o extender estadias desde el calendario principal",
                    "Crear reservas nuevas en huecos libres",
                  ]}
                />
              </section>
                </div>
              </div>
            </aside>
          </>
        ) : null}
      </section>

      {contextMenu && contextRoom ? (
        <div
          className="room-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="context-menu-heading">
            <strong>Hab. {contextRoom.number}</strong>
            <span>{contextFlow?.label}</span>
          </div>
          <button onClick={() => openRoom(contextRoom.id)}>
            {contextReservation?.status === "in_house" ? <ReceiptText size={15} /> : <DoorOpen size={15} />}
            {contextReservation?.status === "in_house" ? "Ver ficha y cuenta" : "Ver ficha"}
          </button>
          {contextFlow?.canCreateReservation ? (
            <button onClick={() => openReservationCalendar(contextRoom.id)}>
              <CalendarPlus size={15} />
              Crear reserva
            </button>
          ) : null}
          {contextReservation?.status === "pending" && permissionsState.canUpdate ? (
            <button
              onClick={() => {
                setContextMenu(null);
                runAction(contextReservation, "confirm");
              }}
            >
              <Check size={15} />
              Confirmar reserva
            </button>
          ) : null}
          {contextReservation && ["confirmed", "assigned"].includes(contextReservation.status) ? (
            <>
              {permissionsState.canCheckIn && contextRoomReadyForCheckIn ? (
                <button
                  onClick={() => {
                    setContextMenu(null);
                    runAction(contextReservation, "check-in");
                  }}
                >
                  <Check size={15} />
                  Check-in
                </button>
              ) : null}
              {permissionsState.canUpdate ? (
                <button
                  onClick={() => {
                    setContextMenu(null);
                    runAction(contextReservation, "cancel");
                  }}
                >
                  <X size={15} />
                  Cancelar reserva
                </button>
              ) : null}
            </>
          ) : null}
          {contextReservation?.status === "in_house" ? (
            <button
              onClick={() => {
                setContextMenu(null);
                openRoom(contextRoom.id);
              }}
            >
              <CreditCard size={15} />
              Cobrar / salida
            </button>
          ) : null}
          <div className="context-menu-separator" />
          <button
            onClick={() => {
              setContextMenu(null);
              updateRoomStatusForRoom(contextRoom, "cleaningStatus", "clean");
            }}
          >
            <Sparkles size={15} />
            Marcar limpia
          </button>
          <button
            onClick={() => {
              setContextMenu(null);
              updateRoomStatusForRoom(contextRoom, "cleaningStatus", "dirty");
            }}
          >
            <X size={15} />
            Marcar sucia
          </button>
          <div className="context-menu-separator" />
          <button
            onClick={() => {
              setContextMenu(null);
              updateRoomStatusForRoom(
                contextRoom,
                "commercialStatus",
                contextRoom.commercialStatus === "blocked" ? "available" : "blocked",
              );
            }}
          >
            <Wrench size={15} />
            {contextRoom.commercialStatus === "blocked" ? "Habilitar" : "Bloquear"}
          </button>
          <button
            onClick={() => {
              setContextMenu(null);
              updateRoomStatusForRoom(
                contextRoom,
                "maintenanceStatus",
                contextRoom.maintenanceStatus === "ok" ? "pending" : "ok",
              );
            }}
          >
            <Wrench size={15} />
            {contextRoom.maintenanceStatus === "ok" ? "Mantenimiento pendiente" : "Mantenimiento OK"}
          </button>
        </div>
      ) : null}
    </>
  );
}

function StatusLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      {icon}
      <span>{label}</span>
      <strong>{statusLabels[value] ?? value}</strong>
    </div>
  );
}

function RoomCapabilityPanel({
  title,
  items,
  className = "",
}: {
  title: string;
  items: string[];
  className?: string;
}) {
  return (
    <div className={`reservation-capability-panel ${className}`}>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
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
    <label>
      {label}
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {values.map((status) => (
          <option value={status} key={status}>
            {statusLabels[status] ?? status}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ value }: { value: string }) {
  const tone = value === "available" ? "" : value === "occupied" ? "warn" : "bad";
  return <span className={`badge ${tone}`}>{statusLabels[value] ?? value}</span>;
}

function activeReservationForRoom(room: Room, reservations: Reservation[]) {
  return (
    reservations.find(
      (item) =>
        item.assignedRoom?.id === room.id &&
        ACTIVE_ROOM_RESERVATION_STATUSES.includes(item.status),
    ) ?? null
  );
}

function getBoardStatusKey(room: Room, reservation?: Reservation | null): BoardStatusFilter {
  if (room.commercialStatus === "blocked") return "blocked";
  if (room.maintenanceStatus === "out_of_service" || room.commercialStatus === "out_of_service") {
    return "maintenance";
  }
  if (reservation?.status === "in_house" || room.commercialStatus === "occupied") {
    return "occupied";
  }
  if (room.cleaningStatus === "dirty" || room.cleaningStatus === "cleaning") {
    return "dirty";
  }
  if (room.maintenanceStatus !== "ok") {
    return "maintenance";
  }
  if (reservation) return "reserved";
  return "free";
}

function getBoardStatusLabel(room: Room, reservation?: Reservation | null) {
  const status = getBoardStatusKey(room, reservation);
  if (status === "occupied" && reservation && isToday(reservation.checkOutDate)) return "Sale hoy";
  if (status === "reserved" && reservation && isToday(reservation.checkInDate)) return "Llega hoy";
  if (status === "reserved") return "Reservada";
  if (status === "dirty") return room.cleaningStatus === "cleaning" ? "En limpieza" : "Por limpiar";
  if (status === "maintenance") {
    return room.commercialStatus === "out_of_service" || room.maintenanceStatus === "out_of_service"
      ? "Fuera de servicio"
      : "Mantenimiento";
  }
  if (status === "blocked") return "Bloqueada";
  if (status === "occupied") return "Ocupada";
  return "Libre";
}

function getRoomTilePrimary(room: Room, reservation?: Reservation | null) {
  const status = getBoardStatusKey(room, reservation);
  if ((status === "occupied" || status === "reserved") && reservation) {
    return `${reservation.guest.lastName}, ${reservation.guest.firstName}`;
  }
  if (status === "free") return "Disponible";
  if (status === "dirty") return room.cleaningStatus === "cleaning" ? "Limpieza en curso" : "Por limpiar";
  if (status === "maintenance") {
    return room.commercialStatus === "out_of_service" || room.maintenanceStatus === "out_of_service"
      ? "Fuera de servicio"
      : "Mantenimiento pendiente";
  }
  if (status === "blocked") return "Bloqueada";
  return statusLabels[room.commercialStatus] ?? room.commercialStatus;
}

function getRoomTileSecondary(room: Room, reservation?: Reservation | null) {
  const status = getBoardStatusKey(room, reservation);
  if (reservation && ["dirty", "maintenance", "blocked"].includes(status)) {
    return `Reserva: ${reservation.guest.lastName} - ${formatDateShort(reservation.checkInDate)}`;
  }
  if (reservation) {
    return `${reservation.adults + reservation.children} pax - ${formatDateShort(
      reservation.checkOutDate,
    )}`;
  }
  if (room.cleaningStatus === "dirty") return "Salida reciente";
  if (room.cleaningStatus === "cleaning") return "Mucama asignada";
  if (status === "maintenance") return "No disponible para venta";
  if (status === "blocked") return "Bloqueo manual";
  return `${room.roomType.name} - ${room.capacity} pax`;
}

function getBoardKpis(rooms: Room[], reservations: Reservation[]) {
  const roomIds = new Set(rooms.map((room) => room.id));
  const statusByRoom = rooms.map((room) => getBoardStatusKey(room, activeReservationForRoom(room, reservations)));
  const total = rooms.length;
  const occupied = statusByRoom.filter((status) => status === "occupied").length;
  const activeReservations = reservations.filter(
    (reservation) =>
      reservation.assignedRoom?.id &&
      roomIds.has(reservation.assignedRoom.id) &&
      ACTIVE_ROOM_RESERVATION_STATUSES.includes(reservation.status),
  );
  const arrivals = activeReservations.filter(
    (reservation) =>
      ["pending", "confirmed", "assigned"].includes(reservation.status) &&
      isToday(reservation.checkInDate),
  ).length;
  const departures = activeReservations.filter(
    (reservation) => reservation.status === "in_house" && isToday(reservation.checkOutDate),
  ).length;
  const toClean = statusByRoom.filter((status) => status === "dirty").length;
  const outOfService = statusByRoom.filter(
    (status) => status === "maintenance" || status === "blocked",
  ).length;

  return {
    total,
    occupied,
    arrivals,
    departures,
    toClean,
    outOfService,
    occupancyRate: total ? Math.round((occupied / total) * 100) : 0,
  };
}

function mergeRoomOrder(current: string[], rooms: Room[]) {
  const roomIds = new Set(rooms.map((room) => room.id));
  const known = current.filter((roomId) => roomIds.has(roomId));
  const knownSet = new Set(known);
  const missing = [...rooms]
    .filter((room) => !knownSet.has(room.id))
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    .map((room) => room.id);
  return [...known, ...missing];
}

function sameStringArray(first: string[], second: string[]) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function isToday(value: string) {
  return value.slice(0, 10) === toDateInput(new Date());
}

function normalizeSearch(value?: string | number | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(parseDateInput(value.slice(0, 10)));
}

function roomTone(room: Room, reservation?: Reservation | null) {
  if (room.commercialStatus === "blocked") {
    return "tile-blocked";
  }
  if (room.maintenanceStatus === "out_of_service" || room.commercialStatus === "out_of_service") {
    return "tile-bad";
  }
  if (reservation?.status === "in_house" || room.commercialStatus === "occupied") {
    return "tile-occupied";
  }
  if (reservation || room.commercialStatus === "blocked") {
    return "tile-reserved";
  }
  if (room.cleaningStatus === "dirty" || room.maintenanceStatus === "pending") {
    return "tile-attention";
  }
  return "tile-free";
}

function getRoomFlow(room: Room, reservation?: Reservation | null) {
  if (reservation?.status === "in_house" || room.commercialStatus === "occupied") {
    return { label: "Alojada", canCreateReservation: false };
  }
  if (room.commercialStatus === "blocked") {
    return { label: "Bloqueada", canCreateReservation: false };
  }
  if (room.commercialStatus === "out_of_service" || room.maintenanceStatus === "out_of_service") {
    return { label: "Fuera de servicio", canCreateReservation: false };
  }
  if (room.maintenanceStatus !== "ok") {
    return { label: "Mantenimiento pendiente", canCreateReservation: false };
  }
  if (room.cleaningStatus === "dirty" || room.cleaningStatus === "cleaning") {
    return { label: "Limpieza pendiente", canCreateReservation: false };
  }
  if (reservation?.status === "pending") {
    return { label: "Pendiente", canCreateReservation: false };
  }
  if (reservation && ["confirmed", "assigned"].includes(reservation.status)) {
    return { label: "Reservada", canCreateReservation: false };
  }
  return { label: "Libre", canCreateReservation: true };
}

function isRoomReadyForCheckIn(room: Room) {
  return (
    room.commercialStatus === "available" &&
    room.cleaningStatus === "clean" &&
    room.maintenanceStatus === "ok"
  );
}

function getRoomActionFlow(
  room: Room,
  reservation: Reservation | null,
  folio: Folio | null,
  folioLoading: boolean,
): RoomActionFlow {
  if (reservation?.status === "in_house") {
    if (folioLoading) {
      return {
        kind: "account_loading",
        title: "Alojada",
        description: "Estoy revisando la cuenta para decidir si corresponde cobrar o cerrar salida.",
        tone: "neutral",
      };
    }

    const balance = folio?.totals.balance ?? 0;
    if (folio && balance > 0.009) {
      return {
        kind: "settle_account",
        title: "Cobrar y facturar",
        description: `Saldo pendiente: ${formatMoney(balance, folio.currency)}. Primero registrar pago, despues preparar comprobante y salida.`,
        tone: "warn",
      };
    }

    return {
      kind: "ready_check_out",
      title: "Lista para salida",
      description:
        "La cuenta no tiene saldo pendiente. Se puede preparar factura y hacer check-out; al salir quedara sucia automaticamente.",
      tone: "good",
    };
  }

  if (room.commercialStatus === "occupied") {
    return {
      kind: "occupied_unknown",
      title: "Ocupada sin reserva activa",
      description:
        "La habitacion figura ocupada, pero no encuentro una reserva alojada en el tablero. Conviene revisar cuenta e historial.",
      tone: "warn",
    };
  }

  if (room.commercialStatus === "blocked") {
    return {
      kind: "blocked",
      title: "Bloqueada",
      description: "No se vende ni se aloja hasta que recepcion o gerencia la habilite.",
      tone: "bad",
    };
  }

  if (room.commercialStatus === "out_of_service" || room.maintenanceStatus === "out_of_service") {
    return {
      kind: "unavailable",
      title: "Fuera de servicio",
      description: reservation
        ? "Tiene una reserva asignada, pero no puede recibir ingreso. Cambia la habitacion o cerra el problema operativo."
        : "No disponible para reservas ni check-in hasta cerrar el problema operativo.",
      tone: "bad",
    };
  }

  if (room.maintenanceStatus !== "ok") {
    return {
      kind: "maintenance",
      title: "Resolver mantenimiento",
      description: "Hay una tarea tecnica pendiente antes de usar esta habitacion.",
      tone: "warn",
    };
  }

  if (reservation && ["confirmed", "assigned"].includes(reservation.status) && room.cleaningStatus !== "clean") {
    return {
      kind: "housekeeping",
      title: "Preparar para check-in",
      description: "La reserva existe, pero la habitacion todavia no esta limpia para alojar.",
      tone: "warn",
    };
  }

  if (reservation?.status === "pending") {
    return {
      kind: "confirm_reservation",
      title: "Confirmar reserva",
      description: "La habitacion ya tiene una reserva pendiente. Confirmala antes de avanzar al ingreso.",
      tone: "neutral",
    };
  }

  if (reservation && ["confirmed", "assigned"].includes(reservation.status)) {
    return {
      kind: "check_in",
      title: "Check-in y huespedes",
      description:
        "Validar titular, pax y datos de ingreso. Al hacer check-in se abre la cuenta y la habitacion pasa a ocupada.",
      tone: "good",
    };
  }

  if (room.cleaningStatus !== "clean") {
    return {
      kind: "housekeeping",
      title: "Enviar a limpieza",
      description: "Antes de vender o alojar, housekeeping tiene que dejar la habitacion limpia.",
      tone: "warn",
    };
  }

  return {
    kind: "create_reservation",
    title: "Disponible para reservar",
    description: "Abrir el calendario, elegir fechas con drag and drop y crear la reserva desde esa seleccion.",
    tone: "good",
  };
}

function getRoomPosition(
  room: Room,
  index: number,
  _selectedFloor: string,
  layout: BoardLayout,
) {
  if (layout[room.id]) return layout[room.id];
  return defaultRoomPosition(index);
}

function defaultRoomPosition(index: number) {
  return {
    x: BOARD_PADDING + (index % DEFAULT_COLUMNS) * (TILE_WIDTH + TILE_GAP),
    y: BOARD_PADDING + Math.floor(index / DEFAULT_COLUMNS) * (TILE_HEIGHT + TILE_GAP),
  };
}

function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function initialReservationForm(): ReservationForm {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return {
    firstName: "",
    lastName: "",
    phone: "",
    checkInDate: toDateInput(today),
    checkOutDate: toDateInput(tomorrow),
    adults: "2",
    children: "0",
    totalAmount: "",
    depositAmount: "",
    depositPaid: false,
    depositMethod: "cash",
    depositReference: "",
    notes: "",
  };
}

function initialChargeForm(): ChargeForm {
  return {
    kind: "extra",
    description: "",
    quantity: "1",
    unitAmount: "",
  };
}

function initialPaymentForm(): PaymentForm {
  return {
    method: "cash",
    amount: "",
    reference: "",
  };
}

function initialCheckInForm(): CheckInForm {
  return {
    adults: "1",
    children: "0",
    occupants: [emptyOccupantForm("adult", true)],
  };
}

function buildCheckInForm(reservation: Reservation): CheckInForm {
  const occupantForms =
    reservation.occupants?.map((occupant) => ({
      firstName: occupant.firstName,
      lastName: occupant.lastName,
      documentType: occupant.documentType ?? "",
      documentNumber: occupant.documentNumber ?? "",
      phone: occupant.phone ?? "",
      nationality: occupant.nationality ?? "",
      ageCategory: occupant.ageCategory,
      primary: occupant.primary,
    })) ?? [];

  if (!occupantForms.length) {
    occupantForms.push({
      firstName: reservation.guest.firstName,
      lastName: reservation.guest.lastName,
      documentType: reservation.guest.documentType ?? "DNI",
      documentNumber: reservation.guest.documentNumber ?? "",
      phone: reservation.guest.phone ?? "",
      nationality: reservation.guest.nationality ?? "",
      ageCategory: "adult",
      primary: true,
    });
  }

  return resizeCheckInForm({
    adults: String(reservation.adults),
    children: String(reservation.children),
    occupants: occupantForms,
  });
}

function resizeCheckInForm(form: CheckInForm): CheckInForm {
  const adults = Math.max(1, Number.parseInt(form.adults, 10) || 1);
  const children = Math.max(0, Number.parseInt(form.children, 10) || 0);
  const adultOccupants = form.occupants.filter((occupant) => occupant.ageCategory === "adult");
  const childOccupants = form.occupants.filter((occupant) => occupant.ageCategory === "child");

  while (adultOccupants.length < adults) {
    adultOccupants.push(emptyOccupantForm("adult", adultOccupants.length === 0));
  }
  while (childOccupants.length < children) {
    childOccupants.push(emptyOccupantForm("child", false));
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

function emptyOccupantForm(
  ageCategory: ReservationOccupantForm["ageCategory"],
  primary: boolean,
): ReservationOccupantForm {
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

function normalizeOccupantForms(occupants: ReservationOccupantForm[]) {
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

function countCompleteOccupants(occupants: ReservationOccupant[]) {
  return occupants.filter(
    (occupant) => occupant.firstName.trim() && occupant.lastName.trim(),
  ).length;
}

function occupantLabel(
  occupant: ReservationOccupantForm,
  index: number,
  occupants: ReservationOccupantForm[],
) {
  const number = occupants
    .slice(0, index + 1)
    .filter((item) => item.ageCategory === occupant.ageCategory).length;
  return occupant.ageCategory === "adult" ? `Adulto ${number}` : `Menor ${number}`;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toMonthInput(date: Date) {
  return date.toISOString().slice(0, 7);
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function parseMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function addMonthsToInput(value: string, months: number) {
  const date = parseMonthInput(value);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toMonthInput(date);
}

function daysForMonth(monthInput: string) {
  const start = parseMonthInput(monthInput);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const days: Date[] = [];
  for (let day = 1; day <= end.getUTCDate(); day += 1) {
    days.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day)));
  }
  return days;
}

function reservationCoversDay(reservation: Reservation, day: Date) {
  const checkIn = parseDateInput(reservation.checkInDate.slice(0, 10));
  const checkOut = parseDateInput(reservation.checkOutDate.slice(0, 10));
  return day >= checkIn && day < checkOut;
}

function formatDayShort(day: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", weekday: "short", timeZone: "UTC" }).format(day);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
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
