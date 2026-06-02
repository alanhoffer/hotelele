"use client";

export type ParsedArgentineDni = {
  firstName?: string;
  lastName?: string;
  documentType?: string;
  documentNumber?: string;
  nationality?: string;
  gender?: string;
  birthDate?: string;
  issueDate?: string;
  cuil?: string;
  confidence: "high" | "medium" | "low";
};

export function parseArgentineDniPdf417(rawText: string): ParsedArgentineDni {
  const parts = rawText
    .replace(/\u001d/g, "@")
    .replace(/\r?\n/g, "@")
    .split("@")
    .map((part) => part.trim())
    .filter(Boolean);

  const sexIndex = parts.findIndex(
    (part, index) => isGender(part) && isLikelyDni(parts[index + 1]) && Boolean(parts[index - 1] && parts[index - 2]),
  );

  if (sexIndex >= 2) {
    const dates = parts.slice(sexIndex + 2).filter(isDateLike);
    const cuil = parts.find((part) => /^2[037]\d{9}$/.test(onlyDigits(part)));
    return removeEmpty({
      firstName: toPersonCase(parts[sexIndex - 1]),
      lastName: toPersonCase(parts[sexIndex - 2]),
      documentType: "DNI",
      documentNumber: onlyDigits(parts[sexIndex + 1]),
      nationality: "Argentina",
      gender: parts[sexIndex].toUpperCase(),
      birthDate: normalizeDate(dates[0]),
      issueDate: normalizeDate(dates[1]),
      cuil: cuil ? onlyDigits(cuil) : undefined,
      confidence: "high",
    });
  }

  const documentIndex = parts.findIndex(isLikelyDni);
  if (documentIndex >= 2) {
    return removeEmpty({
      firstName: toPersonCase(parts[documentIndex - 1]),
      lastName: toPersonCase(parts[documentIndex - 2]),
      documentType: "DNI",
      documentNumber: onlyDigits(parts[documentIndex]),
      nationality: "Argentina",
      confidence: "medium",
    });
  }

  const dniMatch = rawText.match(/\b\d{7,8}\b/);
  return removeEmpty({
    documentType: dniMatch ? "DNI" : undefined,
    documentNumber: dniMatch ? dniMatch[0] : undefined,
    nationality: "Argentina",
    confidence: dniMatch ? "low" : "low",
  });
}

function removeEmpty(parsed: ParsedArgentineDni): ParsedArgentineDni {
  const cleaned = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined && value !== ""),
  ) as ParsedArgentineDni;
  return cleaned.confidence ? cleaned : { confidence: "low" };
}

function isLikelyDni(value?: string) {
  const digits = onlyDigits(value);
  return /^\d{7,8}$/.test(digits);
}

function isGender(value?: string) {
  return /^(M|F|X)$/i.test(value ?? "");
}

function isDateLike(value?: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value ?? "") || /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
}

function normalizeDate(value?: string) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function onlyDigits(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function toPersonCase(value?: string) {
  return (value ?? "")
    .toLocaleLowerCase("es-AR")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("es-AR") + word.slice(1))
    .join(" ");
}
