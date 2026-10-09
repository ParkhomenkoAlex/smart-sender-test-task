import { isCurrentCsrfToken } from "./state";
import { csrfErrorResponse } from "./responses";
import type { ValidationPayload } from "./types";

export function hasRequiredRequestHeaders(request: Request) {
  const isXmlHttpRequest =
    request.headers.get("X-Requested-With") === "XMLHttpRequest";
  const needsCsrfToken = ["POST", "PUT"].includes(request.method);
  const hasValidCsrfToken =
    !needsCsrfToken || isCurrentCsrfToken(request.headers.get("X-CSRF-TOKEN"));

  return isXmlHttpRequest && hasValidCsrfToken;
}

export function getRequestHeaderError(request: Request) {
  return hasRequiredRequestHeaders(request) ? undefined : csrfErrorResponse();
}

export async function getJsonBody(request: Request) {
  try {
    const body: unknown = await request.json();

    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

export function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function isFingerprint(value: string) {
  return /^[a-f\d]{32}$/i.test(value);
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function addRequiredFieldError(
  payload: ValidationPayload,
  field: string,
  value: string,
) {
  if (!value.trim()) {
    payload[field] = [`The ${field} field is required.`];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
