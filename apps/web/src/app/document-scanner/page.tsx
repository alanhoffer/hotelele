"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileUp,
  Loader2,
  RefreshCw,
  ScanLine,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import { Protected } from "../../components/protected";
import { apiFetch } from "../../lib/api";
import { parseArgentineDniPdf417, type ParsedArgentineDni } from "../../lib/argentine-dni";

type ActiveScanRequest = {
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

export default function DocumentScannerPage() {
  return (
    <Protected>
      {(session) => <DocumentScanner userName={session.user.name} />}
    </Protected>
  );
}

function DocumentScanner({ userName }: { userName: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const sentRef = useRef(false);
  const [activeRequest, setActiveRequest] = useState<ActiveScanRequest | null>(null);
  const [parsed, setParsed] = useState<ParsedArgentineDni | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadActiveRequest() {
    setLoading(true);
    setError(null);
    try {
      const request = await apiFetch<ActiveScanRequest | null>("/document-scans/requests/active");
      setActiveRequest(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar el pedido de escaneo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActiveRequest();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    if (!activeRequest || !videoRef.current) return;
    setError(null);
    setMessage("Apunta al codigo PDF417 del DNI. Conviene que este horizontal y con buena luz.");
    setCameraActive(true);
    sentRef.current = false;

    try {
      const { BrowserPDF417Reader } = await import("@zxing/browser");
      const reader = new BrowserPDF417Reader();
      controlsRef.current = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, scanError, controls) => {
          if (!result || sentRef.current) return;
          sentRef.current = true;
          controls.stop();
          setCameraActive(false);
          const snapshot = captureVideoFrame(videoRef.current);
          handleDecodedText(result.getText(), snapshot);
          if (scanError) setError(null);
        },
      );
    } catch (err) {
      setCameraActive(false);
      setError(err instanceof Error ? err.message : "No se pudo abrir la camara.");
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setMessage("Leyendo foto...");
    try {
      const imageDataUrl = await compressImage(file);
      setPhotoDataUrl(imageDataUrl);
      const { BrowserPDF417Reader } = await import("@zxing/browser");
      const reader = new BrowserPDF417Reader();
      const image = await loadImage(imageDataUrl);
      const result = await reader.decodeFromImageElement(image);
      await handleDecodedText(result.getText(), imageDataUrl);
    } catch {
      setParsed(null);
      setMessage(null);
      setError("No pude leer el codigo automaticamente. Podes mandar la foto para cargarlo en recepcion.");
    }
  }

  async function handleDecodedText(rawText: string, imageDataUrl?: string | null) {
    const nextParsed = parseArgentineDniPdf417(rawText);
    setParsed(nextParsed);
    if (imageDataUrl) setPhotoDataUrl(imageDataUrl);

    if (!nextParsed.documentNumber && !nextParsed.firstName && !nextParsed.lastName) {
      setError("Lei un codigo, pero no parece un DNI argentino valido.");
      return;
    }

    await sendResult(nextParsed, imageDataUrl ?? photoDataUrl ?? undefined);
  }

  async function sendPhotoOnly() {
    if (!photoDataUrl) return;
    await sendResult({ documentType: "DNI", nationality: "Argentina", confidence: "low" }, photoDataUrl, true);
  }

  async function sendResult(nextParsed: ParsedArgentineDni, imageDataUrl?: string | null, photoOnly = false) {
    if (!activeRequest) {
      setError("No hay ningun pedido activo desde recepcion.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiFetch<ActiveScanRequest>(`/document-scans/requests/${activeRequest.id}/result`, {
        method: "POST",
        body: JSON.stringify({
          parsed: nextParsed,
          imageDataUrl,
          note: photoOnly ? "Foto enviada sin lectura automatica." : undefined,
        }),
      });
      setMessage(photoOnly ? "Foto enviada a recepcion." : "Documento enviado a recepcion.");
      await loadActiveRequest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el documento.");
    } finally {
      setSending(false);
    }
  }

  const canScan = activeRequest?.status === "waiting";

  return (
    <main className="document-scanner-page">
      <section className="document-scanner-shell">
        <header className="document-scanner-header">
          <div>
            <span>Scanner DNI</span>
            <h1>Enviar documento a recepcion</h1>
            <p>{userName}</p>
          </div>
          <button type="button" onClick={loadActiveRequest} disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
        </header>

        <section className={`scanner-request-card ${activeRequest?.status === "received" ? "sent" : ""}`}>
          {loading ? (
            <p>Cargando pedido...</p>
          ) : activeRequest ? (
            <>
              <span>{activeRequest.status === "received" ? "Enviado" : "Pedido activo"}</span>
              <h2>{activeRequest.occupantLabel || `Huesped ${activeRequest.occupantIndex + 1}`}</h2>
              <p>
                Reserva {activeRequest.reservationCode || activeRequest.reservationId}. Vence{" "}
                {new Date(activeRequest.expiresAt).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </>
          ) : (
            <>
              <span>Sin pedido</span>
              <h2>Abrir desde la web</h2>
              <p>En recepcion entra a Huespedes, abre el rooming y toca "Escanear con celular".</p>
            </>
          )}
        </section>

        {error ? (
          <div className="scanner-alert bad">
            <AlertTriangle size={18} />
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="scanner-alert good">
            <CheckCircle2 size={18} />
            {message}
          </div>
        ) : null}

        <section className="scanner-camera-card">
          <div className="scanner-video-frame">
            <video ref={videoRef} muted playsInline />
            {!cameraActive ? (
              <div className="scanner-video-empty">
                <ScanLine size={34} />
                <strong>{canScan ? "Camara lista" : "Esperando pedido"}</strong>
                <span>PDF417 del DNI argentino</span>
              </div>
            ) : null}
          </div>

          <div className="scanner-actions">
            {cameraActive ? (
              <button className="secondary-button" type="button" onClick={stopCamera}>
                <X size={18} />
                Detener
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={startCamera} disabled={!canScan || sending}>
                <Camera size={18} />
                Escanear con camara
              </button>
            )}
            <label className={`scanner-file-button ${!canScan || sending ? "disabled" : ""}`}>
              <FileUp size={18} />
              Sacar/subir foto
              <input
                accept="image/*"
                capture="environment"
                disabled={!canScan || sending}
                type="file"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </section>

        {parsed || photoDataUrl ? (
          <section className="scanner-result-card">
            <div className="section-title-row">
              <div>
                <span className="detail-kicker">Resultado</span>
                <h3>Datos detectados</h3>
              </div>
              <span className="status-pill good">{parsed?.confidence || "foto"}</span>
            </div>
            <div className="scanner-result-grid">
              <ResultFact label="Nombre" value={parsed?.firstName} />
              <ResultFact label="Apellido" value={parsed?.lastName} />
              <ResultFact label="Documento" value={parsed?.documentNumber} />
              <ResultFact label="Nacionalidad" value={parsed?.nationality} />
            </div>
            {photoDataUrl ? <img alt="Documento enviado" src={photoDataUrl} /> : null}
            {photoDataUrl && !parsed?.documentNumber ? (
              <button className="primary-button" type="button" onClick={sendPhotoOnly} disabled={!canScan || sending}>
                {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                Enviar foto a recepcion
              </button>
            ) : null}
          </section>
        ) : null}

        <footer className="scanner-footer-note">
          <Smartphone size={16} />
          El codigo no se guarda en la base. Solo se usa para completar la reserva abierta por tu usuario.
        </footer>
      </section>
    </main>
  );
}

function ResultFact({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || "Pendiente"}</strong>
    </div>
  );
}

function captureVideoFrame(video: HTMLVideoElement | null) {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 900 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

async function compressImage(file: File) {
  const sourceUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1100 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return sourceUrl;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo leer la imagen."));
    image.src = src;
  });
}
