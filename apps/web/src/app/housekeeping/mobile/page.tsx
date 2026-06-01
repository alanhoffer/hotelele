"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  DoorOpen,
  Loader2,
  LogOut,
  PackagePlus,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
  Wifi,
  WifiOff,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import {
  housekeepingPriorityLabels,
  housekeepingTaskStatusLabels,
  maintenancePriorityLabels,
  maintenancePriorities,
  permissions,
  statusLabels,
} from "@hotel-pms/shared";
import { Protected } from "../../../components/protected";
import { clearToken, apiFetch } from "../../../lib/api";

type Room = {
  id: string;
  number: string;
  floor?: string | null;
  block?: string | null;
  capacity: number;
  cleaningStatus: string;
  commercialStatus: string;
  maintenanceStatus: string;
  notes?: string | null;
  roomType: { code: string; name: string };
};

type HousekeepingTask = {
  id: string;
  status: keyof typeof housekeepingTaskStatusLabels;
  priority: keyof typeof housekeepingPriorityLabels;
  source: string;
  notes?: string | null;
  pauseReason?: string | null;
  rejectionReason?: string | null;
  checklistJson?: unknown;
  suppliesJson?: unknown;
  issueNotes?: string | null;
  lostFoundNotes?: string | null;
  startedAt?: string | null;
  pausedAt?: string | null;
  finishedAt?: string | null;
  inspectedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  room: Room;
  assignedTo?: { name: string } | null;
};

type HousekeepingSummary = {
  active: number;
  assignedToMe: number;
  pending: number;
  inProgress: number;
  inspection: number;
  readyToSell: number;
  completedToday: number;
  urgent: number;
  arrivalToday: number;
  departureToday: number;
  overdue: number;
};

type TaskFilter =
  | "all"
  | "mine"
  | "pending"
  | "in_progress"
  | "inspection"
  | "urgent"
  | "arrival_today"
  | "departure_today";

type ChecklistState = Record<string, boolean>;

type SupplyState = {
  towels: boolean;
  sheets: boolean;
  amenities: boolean;
  minibar: boolean;
  consumedMinibar: string;
  note: string;
};

type IssueState = {
  title: string;
  description: string;
  priority: (typeof maintenancePriorities)[number];
  outOfService: boolean;
};

const checklistItems = [
  { key: "beds", label: "Camas" },
  { key: "bathroom", label: "Bano" },
  { key: "towels", label: "Toallas" },
  { key: "amenities", label: "Amenities" },
  { key: "floor", label: "Piso" },
  { key: "minibar", label: "Frigobar" },
];

const emptySupplyState: SupplyState = {
  towels: false,
  sheets: false,
  amenities: false,
  minibar: false,
  consumedMinibar: "",
  note: "",
};

const emptyIssueState: IssueState = {
  title: "Incidencia housekeeping",
  description: "",
  priority: "medium",
  outOfService: false,
};

const filterLabels: Record<TaskFilter, string> = {
  all: "Todas",
  mine: "Mis tareas",
  pending: "Pendientes",
  in_progress: "En limpieza",
  inspection: "Revision",
  urgent: "Urgentes",
  arrival_today: "Llegadas hoy",
  departure_today: "Salidas hoy",
};

export default function HousekeepingMobilePage() {
  return (
    <Protected>
      {(session) => (
        <HousekeepingMobile
          canUpdate={session.permissions.includes(permissions.housekeepingUpdate)}
          userName={session.user.name}
        />
      )}
    </Protected>
  );
}

function HousekeepingMobile({ canUpdate, userName }: { canUpdate: boolean; userName: string }) {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [summary, setSummary] = useState<HousekeepingSummary | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("mine");
  const [floorFilter, setFloorFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const fallbackSummary = useMemo<HousekeepingSummary>(
    () => ({
      active: tasks.length,
      assignedToMe: tasks.filter((task) => task.assignedTo?.name === userName).length,
      pending: tasks.filter((task) => task.status === "pending").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      inspection: tasks.filter((task) => task.status === "inspection").length,
      readyToSell: 0,
      completedToday: 0,
      urgent: tasks.filter((task) => task.priority === "urgent").length,
      arrivalToday: tasks.filter((task) => task.priority === "arrival_today").length,
      departureToday: tasks.filter((task) => task.source === "check_out" && isToday(task.createdAt)).length,
      overdue: tasks.filter((task) => isOverdue(task.createdAt)).length,
    }),
    [tasks, userName],
  );

  const counters = summary ?? fallbackSummary;

  const floors = useMemo(
    () =>
      Array.from(new Set(tasks.map((task) => task.room.floor).filter((floor): floor is string => Boolean(floor)))).sort(
        naturalSort,
      ),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    const q = normalizeText(search);
    return tasks.filter((task) => {
      if (filter === "mine" && task.assignedTo?.name !== userName) return false;
      if (filter === "pending" && task.status !== "pending") return false;
      if (filter === "in_progress" && task.status !== "in_progress") return false;
      if (filter === "inspection" && task.status !== "inspection") return false;
      if (filter === "urgent" && task.priority !== "urgent" && !isOverdue(task.createdAt)) return false;
      if (filter === "arrival_today" && task.priority !== "arrival_today") return false;
      if (filter === "departure_today" && !(task.source === "check_out" && isToday(task.createdAt))) return false;
      if (floorFilter !== "all" && task.room.floor !== floorFilter) return false;
      if (!q) return true;
      return normalizeText(
        [
          task.room.number,
          task.room.floor,
          task.room.block,
          task.room.roomType.code,
          task.room.roomType.name,
          task.assignedTo?.name,
          task.notes,
          task.source,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(q);
    });
  }, [filter, floorFilter, search, tasks, userName]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [taskRows, summaryRow] = await Promise.all([
        apiFetch<HousekeepingTask[]>("/housekeeping/tasks"),
        apiFetch<HousekeepingSummary>("/housekeeping/summary"),
      ]);
      setTasks(taskRows);
      setSummary(summaryRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las tareas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const setConnected = () => setOnline(true);
    const setDisconnected = () => setOnline(false);
    window.addEventListener("online", setConnected);
    window.addEventListener("offline", setDisconnected);
    return () => {
      window.removeEventListener("online", setConnected);
      window.removeEventListener("offline", setDisconnected);
    };
  }, []);

  async function runTask(id: string, action: string, body: Record<string, unknown> = {}) {
    setActionLoading(`${id}:${action}`);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/housekeeping/tasks/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
      if (["approve", "cancel"].includes(action)) {
        setSelectedTaskId(null);
      }
      setMessage(actionMessage(action));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la tarea.");
    } finally {
      setActionLoading(null);
    }
  }

  async function saveTaskPayload(id: string, endpoint: string, body: Record<string, unknown>, success: string) {
    setActionLoading(`${id}:${endpoint}`);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<HousekeepingTask | { task: HousekeepingTask }>(
        `/housekeeping/tasks/${id}/${endpoint}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      const nextTask = "task" in response ? response.task : response;
      setTasks((current) => current.map((task) => (task.id === id ? nextTask : task)));
      setMessage(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el detalle.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="mobile-housekeeping hk-app">
      <header className="hk-shift-header">
        <div>
          <span>Turno de limpieza</span>
          <h1>{userName}</h1>
          <small>{formatShiftDate(new Date())}</small>
        </div>
        <div className="hk-header-actions">
          <span className={`hk-online ${online ? "is-online" : "is-offline"}`}>
            {online ? <Wifi size={15} /> : <WifiOff size={15} />}
            {online ? "Online" : "Offline"}
          </span>
          <button type="button" onClick={load} disabled={loading} aria-label="Actualizar tareas">
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            aria-label="Salir"
            onClick={() => {
              clearToken();
              window.location.href = "/login";
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="hk-summary-grid" aria-label="Resumen del turno">
        <SummaryTile label="Asignadas" value={counters.assignedToMe} icon={<UserCheck size={17} />} />
        <SummaryTile label="Pendientes" value={counters.pending} icon={<Clock3 size={17} />} />
        <SummaryTile label="Revision" value={counters.inspection} icon={<ClipboardCheck size={17} />} />
        <SummaryTile label="Listas" value={counters.readyToSell} icon={<CheckCircle2 size={17} />} />
        <SummaryTile label="Urgentes" value={counters.urgent + counters.overdue} icon={<AlertTriangle size={17} />} />
        <SummaryTile label="Hechas hoy" value={counters.completedToday} icon={<Sparkles size={17} />} />
      </section>

      <section className="hk-workbar">
        <label className="hk-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar habitacion, piso o nota"
          />
        </label>
        <div className="hk-filter-scroll" aria-label="Filtros">
          {(Object.keys(filterLabels) as TaskFilter[]).map((key) => (
            <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)} type="button">
              {filterLabels[key]} <strong>{filterCount(key, tasks, counters, userName)}</strong>
            </button>
          ))}
        </div>
        {floors.length ? (
          <div className="hk-floor-scroll" aria-label="Filtro por piso">
            <button className={floorFilter === "all" ? "active" : ""} onClick={() => setFloorFilter("all")} type="button">
              Todos los pisos
            </button>
            {floors.map((floor) => (
              <button
                className={floorFilter === floor ? "active" : ""}
                key={floor}
                onClick={() => setFloorFilter(floor)}
                type="button"
              >
                Piso {floor}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <div className="mobile-error hk-message">{error}</div> : null}
      {message ? <div className="success hk-message">{message}</div> : null}

      <section className="hk-task-list">
        <div className="hk-list-title">
          <div>
            <span>{visibleTasks.length} tareas</span>
            <strong>{filterLabels[filter]}</strong>
          </div>
          {loading ? (
            <span className="hk-loading">
              <Loader2 size={15} />
              Actualizando
            </span>
          ) : null}
        </div>

        {visibleTasks.length ? (
          visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canUpdate={canUpdate}
              loadingAction={actionLoading}
              onOpen={() => setSelectedTaskId(task.id)}
              onRun={runTask}
            />
          ))
        ) : (
          <div className="mobile-empty-state hk-empty">
            <Sparkles size={28} />
            No hay tareas para este filtro.
          </div>
        )}
      </section>

      {selectedTask ? (
        <TaskDetailSheet
          task={selectedTask}
          canUpdate={canUpdate}
          loadingAction={actionLoading}
          onClose={() => setSelectedTaskId(null)}
          onRun={runTask}
          onSave={saveTaskPayload}
        />
      ) : null}
    </main>
  );
}

function SummaryTile({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="hk-summary-tile">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TaskCard({
  task,
  canUpdate,
  loadingAction,
  onOpen,
  onRun,
}: {
  task: HousekeepingTask;
  canUpdate: boolean;
  loadingAction: string | null;
  onOpen: () => void;
  onRun: (id: string, action: string, body?: Record<string, unknown>) => Promise<void>;
}) {
  const context = taskContext(task);
  return (
    <article className={`hk-task-card ${taskTone(task)}`}>
      <button className="hk-task-main" onClick={onOpen} type="button">
        <span className="hk-room-number">{task.room.number}</span>
        <span className="hk-room-copy">
          <strong>{task.room.roomType.code} - Piso {task.room.floor ?? "-"}</strong>
          <small>{context}</small>
        </span>
        <span className="hk-task-status">{task.pausedAt ? "Pausada" : housekeepingTaskStatusLabels[task.status]}</span>
      </button>

      <div className="hk-task-meta">
        <span>{statusLabels[task.room.cleaningStatus] ?? task.room.cleaningStatus}</span>
        <span>{task.assignedTo?.name ? task.assignedTo.name : "Sin asignar"}</span>
        <span>{elapsedLabel(task.createdAt)}</span>
      </div>

      <div className="hk-task-footer">
        <span className={`hk-priority hk-priority-${task.priority}`}>
          {housekeepingPriorityLabels[task.priority]}
        </span>
        <PrimaryTaskActions
          task={task}
          canUpdate={canUpdate}
          loadingAction={loadingAction}
          compact
          onRun={onRun}
        />
      </div>
    </article>
  );
}

function TaskDetailSheet({
  task,
  canUpdate,
  loadingAction,
  onClose,
  onRun,
  onSave,
}: {
  task: HousekeepingTask;
  canUpdate: boolean;
  loadingAction: string | null;
  onClose: () => void;
  onRun: (id: string, action: string, body?: Record<string, unknown>) => Promise<void>;
  onSave: (id: string, endpoint: string, body: Record<string, unknown>, success: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(task.notes ?? "");
  const [checklist, setChecklist] = useState<ChecklistState>(() => normalizeChecklist(task.checklistJson));
  const [supplies, setSupplies] = useState<SupplyState>(() => normalizeSupplies(task.suppliesJson));
  const [issue, setIssue] = useState<IssueState>(emptyIssueState);
  const [lostFound, setLostFound] = useState(task.lostFoundNotes ?? "");
  const [pauseReason, setPauseReason] = useState("Reposicion o espera operativa");
  const [rejectReason, setRejectReason] = useState(task.rejectionReason ?? "Requiere repaso");

  useEffect(() => {
    setNotes(task.notes ?? "");
    setChecklist(normalizeChecklist(task.checklistJson));
    setSupplies(normalizeSupplies(task.suppliesJson));
    setIssue(emptyIssueState);
    setLostFound(task.lostFoundNotes ?? "");
    setRejectReason(task.rejectionReason ?? "Requiere repaso");
  }, [task.id, task.notes, task.checklistJson, task.suppliesJson, task.lostFoundNotes, task.rejectionReason]);

  const checklistDone = checklistItems.filter((item) => checklist[item.key]).length;
  const hasMainAction = canUpdate && !["completed", "cancelled"].includes(task.status);

  return (
    <>
      <button className="hk-sheet-backdrop" onClick={onClose} type="button" aria-label="Cerrar detalle" />
      <section className="hk-task-sheet" role="dialog" aria-modal="true" aria-label={`Habitacion ${task.room.number}`}>
        <header className="hk-sheet-header">
          <button className="hk-close-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
          <div>
            <span>Habitacion</span>
            <h2>{task.room.number}</h2>
            <p>{task.room.roomType.name} - Piso {task.room.floor ?? "-"} - {task.room.capacity} pax</p>
          </div>
          <span className={`hk-task-status sheet ${taskTone(task)}`}>
            {task.pausedAt ? "Pausada" : housekeepingTaskStatusLabels[task.status]}
          </span>
        </header>

        <div className="hk-sheet-body">
          <section className="hk-detail-hero">
            <div>
              <span>Proxima accion</span>
              <strong>{primaryActionLabel(task)}</strong>
              <small>{taskContext(task)}</small>
            </div>
            <BedDouble size={30} />
          </section>

          <section className="hk-detail-grid">
            <InfoCell label="Limpieza" value={statusLabels[task.room.cleaningStatus] ?? task.room.cleaningStatus} />
            <InfoCell label="Venta" value={statusLabels[task.room.commercialStatus] ?? task.room.commercialStatus} />
            <InfoCell label="Mantenimiento" value={statusLabels[task.room.maintenanceStatus] ?? task.room.maintenanceStatus} />
            <InfoCell label="Prioridad" value={housekeepingPriorityLabels[task.priority]} />
            <InfoCell label="Asignada" value={task.assignedTo?.name ?? "Sin asignar"} />
            <InfoCell label="Origen" value={sourceLabel(task.source)} />
          </section>

          <section className="hk-detail-section">
            <div className="hk-section-title">
              <div>
                <span>Checklist</span>
                <strong>{checklistDone}/{checklistItems.length} completos</strong>
              </div>
              <ClipboardCheck size={20} />
            </div>
            <div className="hk-checklist">
              {checklistItems.map((item) => (
                <label key={item.key}>
                  <input
                    type="checkbox"
                    checked={Boolean(checklist[item.key])}
                    onChange={(event) => setChecklist((current) => ({ ...current, [item.key]: event.target.checked }))}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <button
              className="secondary-button"
              disabled={!canUpdate || loadingAction === `${task.id}:checklist`}
              onClick={() => onSave(task.id, "checklist", { checklist }, "Checklist guardado.")}
              type="button"
            >
              Guardar checklist
            </button>
          </section>

          <section className="hk-detail-section">
            <div className="hk-section-title">
              <div>
                <span>Notas internas</span>
                <strong>Recepcion y mucamas</strong>
              </div>
              <DoorOpen size={20} />
            </div>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Agregar nota interna" />
            <button
              className="secondary-button"
              disabled={!canUpdate || loadingAction === `${task.id}:notes`}
              onClick={() => onSave(task.id, "notes", { notes }, "Nota guardada.")}
              type="button"
            >
              Guardar nota
            </button>
          </section>

          <section className="hk-detail-section">
            <div className="hk-section-title">
              <div>
                <span>Reposicion / frigobar</span>
                <strong>Faltantes y consumos</strong>
              </div>
              <PackagePlus size={20} />
            </div>
            <div className="hk-checklist compact">
              <label>
                <input
                  checked={supplies.towels}
                  onChange={(event) => setSupplies((current) => ({ ...current, towels: event.target.checked }))}
                  type="checkbox"
                />
                Toallas
              </label>
              <label>
                <input
                  checked={supplies.sheets}
                  onChange={(event) => setSupplies((current) => ({ ...current, sheets: event.target.checked }))}
                  type="checkbox"
                />
                Sabanas
              </label>
              <label>
                <input
                  checked={supplies.amenities}
                  onChange={(event) => setSupplies((current) => ({ ...current, amenities: event.target.checked }))}
                  type="checkbox"
                />
                Amenities
              </label>
              <label>
                <input
                  checked={supplies.minibar}
                  onChange={(event) => setSupplies((current) => ({ ...current, minibar: event.target.checked }))}
                  type="checkbox"
                />
                Frigobar
              </label>
            </div>
            <input
              value={supplies.consumedMinibar}
              onChange={(event) => setSupplies((current) => ({ ...current, consumedMinibar: event.target.value }))}
              placeholder="Consumo frigobar para cargo posterior"
            />
            <textarea
              value={supplies.note}
              onChange={(event) => setSupplies((current) => ({ ...current, note: event.target.value }))}
              placeholder="Detalle de reposicion"
            />
            <button
              className="secondary-button"
              disabled={!canUpdate || loadingAction === `${task.id}:supplies`}
              onClick={() => onSave(task.id, "supplies", { supplies }, "Reposicion guardada.")}
              type="button"
            >
              Guardar reposicion
            </button>
          </section>

          <section className="hk-detail-section">
            <div className="hk-section-title">
              <div>
                <span>Mantenimiento</span>
                <strong>Reportar problema</strong>
              </div>
              <Wrench size={20} />
            </div>
            <input
              value={issue.title}
              onChange={(event) => setIssue((current) => ({ ...current, title: event.target.value }))}
              placeholder="Titulo"
            />
            <textarea
              value={issue.description}
              onChange={(event) => setIssue((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describir problema"
            />
            <div className="hk-inline-fields">
              <label>
                Prioridad
                <select
                  value={issue.priority}
                  onChange={(event) => setIssue((current) => ({ ...current, priority: event.target.value as IssueState["priority"] }))}
                >
                  {maintenancePriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {maintenancePriorityLabels[priority]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hk-toggle-line">
                <input
                  checked={issue.outOfService}
                  onChange={(event) => setIssue((current) => ({ ...current, outOfService: event.target.checked }))}
                  type="checkbox"
                />
                Fuera de servicio
              </label>
            </div>
            <button
              className="secondary-button"
              disabled={!canUpdate || !issue.description.trim() || loadingAction === `${task.id}:issues`}
              onClick={() => onSave(task.id, "issues", issue, "Incidencia enviada a mantenimiento.")}
              type="button"
            >
              Reportar mantenimiento
            </button>
          </section>

          <section className="hk-detail-section">
            <div className="hk-section-title">
              <div>
                <span>Objetos encontrados</span>
                <strong>Lost & found</strong>
              </div>
              <AlertTriangle size={20} />
            </div>
            <textarea
              value={lostFound}
              onChange={(event) => setLostFound(event.target.value)}
              placeholder="Objeto, ubicacion y observaciones"
            />
            <button
              className="secondary-button"
              disabled={!canUpdate || loadingAction === `${task.id}:lost-found`}
              onClick={() => onSave(task.id, "lost-found", { notes: lostFound }, "Objeto encontrado guardado.")}
              type="button"
            >
              Guardar objeto
            </button>
          </section>

          <section className="hk-detail-section">
            <div className="hk-section-title">
              <div>
                <span>Estado habitacion</span>
                <strong>Cambio rapido</strong>
              </div>
              <Sparkles size={20} />
            </div>
            <div className="hk-status-actions">
              {[
                ["dirty", "Sucia"],
                ["cleaning", "En limpieza"],
                ["inspection", "Inspeccion"],
                ["clean", "Limpia"],
              ].map(([value, label]) => (
                <button
                  className={task.room.cleaningStatus === value ? "active" : ""}
                  disabled={!canUpdate || loadingAction === `${task.id}:room-status`}
                  key={value}
                  onClick={() =>
                    onSave(
                      task.id,
                      "room-status",
                      { cleaningStatus: value, reason: "Cambio desde app movil de mucamas" },
                      "Estado de habitacion actualizado.",
                    )
                  }
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="hk-detail-section">
            <div className="hk-section-title">
              <div>
                <span>Historial</span>
                <strong>Movimientos de la tarea</strong>
              </div>
              <Clock3 size={20} />
            </div>
            <div className="hk-history-list">
              <HistoryRow label="Creada" value={task.createdAt} />
              <HistoryRow label="Inicio" value={task.startedAt} />
              <HistoryRow label="Pausa" value={task.pausedAt} detail={task.pauseReason} />
              <HistoryRow label="Terminada" value={task.finishedAt} />
              <HistoryRow label="Rechazada" value={task.rejectedAt} detail={task.rejectionReason} />
              <HistoryRow label="Aprobada" value={task.inspectedAt} />
            </div>
          </section>
        </div>

        <footer className="hk-sheet-action-bar">
          {task.status === "in_progress" ? (
            task.pausedAt ? (
              <button
                className="secondary-button"
                disabled={!canUpdate || loadingAction === `${task.id}:resume`}
                onClick={() => onRun(task.id, "resume")}
                type="button"
              >
                <Play size={18} />
                Reanudar
              </button>
            ) : (
              <button
                className="secondary-button"
                disabled={!canUpdate || loadingAction === `${task.id}:pause`}
                onClick={() => onRun(task.id, "pause", { reason: pauseReason })}
                type="button"
              >
                <Pause size={18} />
                Pausar
              </button>
            )
          ) : null}
          {task.status === "inspection" ? (
            <button
              className="secondary-button danger"
              disabled={!canUpdate || loadingAction === `${task.id}:reject`}
              onClick={() => onRun(task.id, "reject", { reason: rejectReason })}
              type="button"
            >
              <XCircle size={18} />
              Rechazar
            </button>
          ) : null}
          {hasMainAction ? (
            <PrimaryTaskActions task={task} canUpdate={canUpdate} loadingAction={loadingAction} onRun={onRun} />
          ) : (
            <button className="primary-button" onClick={onClose} type="button">
              Cerrar detalle
            </button>
          )}
        </footer>
      </section>
    </>
  );
}

function PrimaryTaskActions({
  task,
  canUpdate,
  loadingAction,
  compact = false,
  onRun,
}: {
  task: HousekeepingTask;
  canUpdate: boolean;
  loadingAction: string | null;
  compact?: boolean;
  onRun: (id: string, action: string, body?: Record<string, unknown>) => Promise<void>;
}) {
  const action = primaryAction(task);
  if (!action) {
    return null;
  }
  const loading = loadingAction === `${task.id}:${action.key}`;
  return (
    <button
      className={compact ? "hk-compact-action" : "primary-button"}
      disabled={!canUpdate || loading || Boolean(task.pausedAt && action.key === "finish")}
      onClick={() => onRun(task.id, action.key, action.body)}
      type="button"
    >
      {action.icon}
      {loading ? "Guardando" : action.label}
    </button>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HistoryRow({ label, value, detail }: { label: string; value?: string | null; detail?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span>{label}</span>
      <strong>{formatShortDate(value)}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function primaryAction(
  task: HousekeepingTask,
): { key: string; label: string; icon: ReactNode; body?: Record<string, unknown> } | null {
  if (task.status === "pending") {
    return { key: "start", label: "Iniciar limpieza", icon: <Play size={18} /> };
  }
  if (task.status === "in_progress") {
    if (task.pausedAt) {
      return { key: "resume", label: "Reanudar", icon: <Play size={18} /> };
    }
    return { key: "finish", label: "Terminar limpieza", icon: <CheckCircle2 size={18} /> };
  }
  if (task.status === "inspection") {
    return { key: "approve", label: "Aprobar limpia", icon: <ClipboardCheck size={18} /> };
  }
  return null;
}

function primaryActionLabel(task: HousekeepingTask) {
  return primaryAction(task)?.label ?? "Ver detalle";
}

function filterCount(filter: TaskFilter, tasks: HousekeepingTask[], summary: HousekeepingSummary, userName: string) {
  if (filter === "all") return summary.active;
  if (filter === "mine") return summary.assignedToMe || tasks.filter((task) => task.assignedTo?.name === userName).length;
  if (filter === "pending") return summary.pending;
  if (filter === "in_progress") return summary.inProgress;
  if (filter === "inspection") return summary.inspection;
  if (filter === "urgent") return summary.urgent + summary.overdue;
  if (filter === "arrival_today") return summary.arrivalToday;
  return summary.departureToday;
}

function taskTone(task: HousekeepingTask) {
  if (task.priority === "urgent" || isOverdue(task.createdAt)) return "is-urgent";
  if (task.status === "inspection") return "is-inspection";
  if (task.status === "in_progress") return task.pausedAt ? "is-paused" : "is-cleaning";
  if (task.priority === "arrival_today") return "is-arrival";
  return "is-pending";
}

function taskContext(task: HousekeepingTask) {
  const pieces = [sourceLabel(task.source)];
  if (task.priority !== "normal") pieces.push(housekeepingPriorityLabels[task.priority]);
  if (task.room.maintenanceStatus !== "ok") pieces.push(statusLabels[task.room.maintenanceStatus] ?? task.room.maintenanceStatus);
  if (task.room.commercialStatus === "out_of_service") pieces.push("Fuera de servicio");
  return pieces.join(" - ");
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    check_out: "Salida reciente",
    room_transfer: "Cambio de habitacion",
    manual: "Manual",
  };
  return labels[source] ?? source;
}

function actionMessage(action: string) {
  const messages: Record<string, string> = {
    start: "Limpieza iniciada.",
    finish: "Habitacion enviada a revision.",
    approve: "Habitacion liberada como limpia.",
    reject: "Tarea devuelta para repaso.",
    pause: "Tarea pausada.",
    resume: "Tarea reanudada.",
    cancel: "Tarea anulada.",
  };
  return messages[action] ?? "Tarea actualizada.";
}

function normalizeChecklist(value: unknown): ChecklistState {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(checklistItems.map((item) => [item.key, Boolean(record[item.key])]));
}

function normalizeSupplies(value: unknown): SupplyState {
  const record = isRecord(value) ? value : {};
  return {
    towels: Boolean(record.towels),
    sheets: Boolean(record.sheets),
    amenities: Boolean(record.amenities),
    minibar: Boolean(record.minibar),
    consumedMinibar: typeof record.consumedMinibar === "string" ? record.consumedMinibar : "",
    note: typeof record.note === "string" ? record.note : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function formatShiftDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function elapsedLabel(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h`;
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isOverdue(value: string) {
  return Date.now() - new Date(value).getTime() > 6 * 60 * 60 * 1000;
}
