export const permissions = {
  roomView: "room.view",
  roomUpdateStatus: "room.update_status",
  availabilityView: "availability.view",
  reservationView: "reservation.view",
  reservationCreate: "reservation.create",
  reservationUpdate: "reservation.update",
  reservationCheckIn: "reservation.check_in",
  reservationCheckOut: "reservation.check_out",
  folioView: "folio.view",
  folioChargeCreate: "folio.charge_create",
  folioPaymentCreate: "folio.payment_create",
  folioChargeVoid: "folio.charge_void",
  folioPaymentVoid: "folio.payment_void",
  housekeepingView: "housekeeping.view",
  housekeepingUpdate: "housekeeping.update",
  maintenanceView: "maintenance.view",
  maintenanceUpdate: "maintenance.update",
  cashView: "cash.view",
  cashManage: "cash.manage",
  invoiceView: "invoice.view",
  invoiceCreate: "invoice.create",
  reservationTransfer: "reservation.transfer",
  calendarView: "calendar.view",
  userView: "user.view",
  roleView: "role.view",
  auditView: "audit.view",
} as const;

export type PermissionCode = (typeof permissions)[keyof typeof permissions];

export const commercialStatuses = [
  "available",
  "occupied",
  "blocked",
  "out_of_service",
] as const;

export const cleaningStatuses = [
  "clean",
  "dirty",
  "cleaning",
  "inspection",
] as const;

export const maintenanceStatuses = [
  "ok",
  "pending",
  "in_progress",
  "out_of_service",
] as const;

export type CommercialStatus = (typeof commercialStatuses)[number];
export type CleaningStatus = (typeof cleaningStatuses)[number];
export type MaintenanceStatus = (typeof maintenanceStatuses)[number];

export const reservationStatuses = [
  "pending",
  "confirmed",
  "assigned",
  "in_house",
  "cancelled",
  "no_show",
  "completed",
] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

export const chargeKinds = [
  "lodging",
  "extra",
  "minibar",
  "laundry",
  "food",
  "beverage",
  "parking",
  "adjustment",
] as const;

export const paymentMethods = [
  "cash",
  "card",
  "transfer",
  "account",
  "usd",
  "other",
] as const;

export const housekeepingTaskStatuses = [
  "pending",
  "in_progress",
  "inspection",
  "completed",
  "cancelled",
] as const;

export const housekeepingPriorities = [
  "normal",
  "arrival_today",
  "urgent",
] as const;

export const maintenanceTicketStatuses = [
  "pending",
  "in_progress",
  "resolved",
  "cancelled",
] as const;

export const maintenancePriorities = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const cashSessionStatuses = ["open", "closed"] as const;
export const cashMovementKinds = ["payment", "expense", "adjustment"] as const;
export const invoiceStatuses = [
  "draft",
  "pending_afip",
  "authorized",
  "rejected",
  "cancelled",
] as const;
export const invoiceTypes = [
  "invoice",
  "credit_note",
  "debit_note",
  "internal_receipt",
] as const;

export type ChargeKind = (typeof chargeKinds)[number];
export type PaymentMethod = (typeof paymentMethods)[number];
export type HousekeepingTaskStatus = (typeof housekeepingTaskStatuses)[number];
export type HousekeepingPriority = (typeof housekeepingPriorities)[number];
export type MaintenanceTicketStatus = (typeof maintenanceTicketStatuses)[number];
export type MaintenancePriority = (typeof maintenancePriorities)[number];
export type CashSessionStatus = (typeof cashSessionStatuses)[number];
export type CashMovementKind = (typeof cashMovementKinds)[number];
export type InvoiceStatus = (typeof invoiceStatuses)[number];
export type InvoiceType = (typeof invoiceTypes)[number];

export const chargeKindLabels: Record<ChargeKind, string> = {
  lodging: "Alojamiento",
  extra: "Extra",
  minibar: "Frigobar",
  laundry: "Lavanderia",
  food: "Comida",
  beverage: "Bebida",
  parking: "Cochera",
  adjustment: "Ajuste",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  account: "Cuenta corriente",
  usd: "USD",
  other: "Otro",
};

export const housekeepingTaskStatusLabels: Record<HousekeepingTaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En limpieza",
  inspection: "Inspeccion",
  completed: "Limpia",
  cancelled: "Anulada",
};

export const housekeepingPriorityLabels: Record<HousekeepingPriority, string> = {
  normal: "Normal",
  arrival_today: "Llegada hoy",
  urgent: "Urgente",
};

export const maintenanceTicketStatusLabels: Record<MaintenanceTicketStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  resolved: "Resuelto",
  cancelled: "Anulado",
};

export const maintenancePriorityLabels: Record<MaintenancePriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Borrador",
  pending_afip: "Pendiente AFIP",
  authorized: "Autorizada",
  rejected: "Rechazada",
  cancelled: "Anulada",
};

export const invoiceTypeLabels: Record<InvoiceType, string> = {
  invoice: "Factura",
  credit_note: "Nota de credito",
  debit_note: "Nota de debito",
  internal_receipt: "Comprobante interno",
};

export const statusLabels: Record<string, string> = {
  available: "Disponible",
  occupied: "Ocupada",
  blocked: "Bloqueada",
  out_of_service: "Fuera de servicio",
  clean: "Limpia",
  dirty: "Sucia",
  cleaning: "En limpieza",
  inspection: "Inspeccion",
  ok: "OK",
  pending: "Pendiente",
  in_progress: "En progreso",
  confirmed: "Confirmada",
  assigned: "Asignada",
  in_house: "Alojada",
  cancelled: "Cancelada",
  no_show: "No-show",
  completed: "Finalizada",
  pending_afip: "Pendiente AFIP",
  authorized: "Autorizada",
  rejected: "Rechazada",
  draft: "Borrador",
  resolved: "Resuelto",
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const roleCodes = {
  admin: "admin",
  reception: "reception",
  housekeeping: "housekeeping",
  maintenance: "maintenance",
  cash: "cash",
  management: "management",
} as const;
