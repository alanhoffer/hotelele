"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Copy,
  HelpCircle,
  LifeBuoy,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

type SupportMessage = {
  id: string;
  from: "user" | "support";
  text: string;
  createdAt: string;
};

const supportWhatsApp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";

const faqs = [
  {
    question: "Como creo una reserva desde el calendario?",
    answer:
      "En Calendario selecciona la habitacion y arrastra sobre los dias de estadia. Luego usa Nueva reserva para abrir el formulario con fechas y habitacion ya cargadas.",
    tags: "reservas calendario crear habitacion fechas",
  },
  {
    question: "Que hago si una habitacion figura sucia?",
    answer:
      "La habitacion debe pasar por Housekeeping. Desde Tablero abre la habitacion y usa Operacion o entra a Mucamas movil para iniciar, terminar y aprobar la limpieza.",
    tags: "habitacion sucia housekeeping mucamas limpieza",
  },
  {
    question: "Como hago check-in?",
    answer:
      "Desde Tablero o Calendario abre la reserva asignada. Si la habitacion esta limpia y lista, la accion principal sera hacer check-in y registrar los huespedes.",
    tags: "check in huesped reserva tablero calendario",
  },
  {
    question: "Por que no puedo vender una habitacion?",
    answer:
      "Puede estar ocupada, sucia, en mantenimiento o fuera de servicio. Abre la habitacion en Tablero y revisa Venta, Limpieza y Mantenimiento en Detalle.",
    tags: "vender disponible bloqueada mantenimiento fuera servicio",
  },
  {
    question: "Como registro un pago?",
    answer:
      "Abre la habitacion, entra en Pagos y usa Registrar pago. La cuenta debe tener folio abierto; normalmente se abre al hacer check-in.",
    tags: "pago caja folio cuenta registrar",
  },
  {
    question: "Como reporto mantenimiento desde mucamas?",
    answer:
      "En Mucamas movil abre la tarea, baja a Mantenimiento, describe el problema y toca Reportar mantenimiento. Si es grave, marca Fuera de servicio.",
    tags: "mantenimiento mucamas reportar problema fuera servicio",
  },
];

const quickPrompts = [
  "No puedo hacer check-in",
  "No aparece una reserva",
  "Habitacion no se puede vender",
  "Problema con caja o pago",
  "Mucamas no ve la tarea",
  "Necesito soporte humano",
];

export function SupportWidget({ context = "PMS" }: { context?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"faq" | "chat">("faq");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      id: "welcome",
      from: "support",
      text: "Hola, soy soporte del hotel. Puedes buscar una respuesta rapida o dejarme una consulta para revisarla.",
      createdAt: new Date().toISOString(),
    },
  ]);

  useEffect(() => {
    const saved = window.localStorage.getItem("hotel-pms-support-chat");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SupportMessage[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      } catch {
        window.localStorage.removeItem("hotel-pms-support-chat");
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("hotel-pms-support-chat", JSON.stringify(messages));
  }, [messages]);

  const filteredFaqs = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return faqs;
    return faqs.filter((faq) => normalize(`${faq.question} ${faq.answer} ${faq.tags}`).includes(needle));
  }, [query]);

  const lastUserMessage = messages.filter((message) => message.from === "user").at(-1)?.text ?? "";

  function sendMessage(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const now = new Date().toISOString();
    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, from: "user", text: clean, createdAt: now },
      {
        id: `s-${Date.now()}`,
        from: "support",
        text:
          "Recibido. Si configuramos el canal humano, esta consulta se enviara directo a soporte. Mientras tanto queda guardada en este equipo.",
        createdAt: now,
      },
    ]);
    setDraft("");
    setMode("chat");
    setOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  function openHumanChannel() {
    const text = encodeURIComponent(`Soporte ${context}: ${lastUserMessage || draft || "Necesito ayuda con el PMS."}`);
    if (supportWhatsApp) {
      window.open(`https://wa.me/${supportWhatsApp}?text=${text}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (supportEmail) {
      window.location.href = `mailto:${supportEmail}?subject=Soporte PMS&body=${text}`;
      return;
    }
    sendMessage(lastUserMessage || draft || "Necesito soporte humano.");
  }

  async function copyConversation() {
    const text = messages
      .map((message) => `${message.from === "user" ? "Usuario" : "Soporte"}: ${message.text}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={`support-widget ${open ? "is-open" : ""}`}>
      {open ? (
        <section className="support-panel" aria-label="Soporte tecnico">
          <header className="support-header">
            <div>
              <span>Soporte tecnico</span>
              <strong>Ayuda rapida del PMS</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar soporte">
              <X size={18} />
            </button>
          </header>

          <nav className="support-tabs" aria-label="Modo de soporte">
            <button className={mode === "faq" ? "active" : ""} type="button" onClick={() => setMode("faq")}>
              <HelpCircle size={16} />
              FAQ
            </button>
            <button className={mode === "chat" ? "active" : ""} type="button" onClick={() => setMode("chat")}>
              <MessageCircle size={16} />
              Chat
            </button>
          </nav>

          {mode === "faq" ? (
            <div className="support-body">
              <label className="support-search">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar ayuda rapida"
                />
              </label>
              <div className="support-quick-grid">
                {quickPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>
                    <Sparkles size={15} />
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="support-faq-list">
                {filteredFaqs.map((faq) => (
                  <article key={faq.question}>
                    <strong>{faq.question}</strong>
                    <p>{faq.answer}</p>
                    <button type="button" onClick={() => sendMessage(`Necesito ayuda: ${faq.question}`)}>
                      Preguntar sobre esto
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="support-body support-chat-body">
              <div className="support-chat-list">
                {messages.map((message) => (
                  <div className={`support-message ${message.from}`} key={message.id}>
                    <span>{message.from === "user" ? <UserRound size={15} /> : <Bot size={15} />}</span>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
              <div className="support-human-actions">
                <button type="button" onClick={openHumanChannel}>
                  <LifeBuoy size={16} />
                  Hablar con soporte
                </button>
                <button type="button" onClick={copyConversation}>
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <form className="support-compose" onSubmit={submit}>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Escribir consulta..."
                />
                <button type="submit" aria-label="Enviar consulta">
                  <Send size={17} />
                </button>
              </form>
            </div>
          )}
        </section>
      ) : null}

      <button className="support-fab" type="button" onClick={() => setOpen((current) => !current)}>
        <LifeBuoy size={22} />
        <span>Soporte</span>
      </button>
    </div>
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
