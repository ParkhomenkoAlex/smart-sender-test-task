import { http, HttpResponse } from "msw";
import { mockUser, testCredentials, webhooks } from "./data";
import { authenticationErrorResponse, errorResponse } from "./responses";
import {
  createDeviceSessionToken,
  hasActiveSession,
  issueCsrfToken,
  issueSession,
  revokeSession,
  rotateSession,
} from "./state";
import {
  addRequiredFieldError,
  getJsonBody,
  getRequestHeaderError,
  getString,
  isFingerprint,
  isHttpUrl,
} from "./request";
import type { ValidationPayload } from "./types";

const defaultPage = 1;
const defaultLimit = 10;

export const handlers = [
  http.get("/csrf", ({ request }) => {
    const headerError = getRequestHeaderError(request);

    if (headerError) {
      return headerError;
    }

    return new HttpResponse(null, {
      status: 204,
      headers: {
        "X-CSRF-TOKEN": issueCsrfToken(),
      },
    });
  }),

  http.post("/auth/login", async ({ request }) => {
    const headerError = getRequestHeaderError(request);

    if (headerError) {
      return headerError;
    }

    const body = await getJsonBody(request);
    const email = getString(body.email);
    const password = getString(body.password);
    const fingerprint = getString(body.fingerprint);
    const payload: ValidationPayload = {};

    addRequiredFieldError(payload, "email", email);
    addRequiredFieldError(payload, "password", password);
    addRequiredFieldError(payload, "fingerprint", fingerprint);

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      payload.email = ["The email must be a valid email address."];
    }

    if (fingerprint && !isFingerprint(fingerprint)) {
      payload.fingerprint = [
        "The fingerprint must be 32 hexadecimal characters.",
      ];
    }

    if (!request.headers.get("X-Captcha-Token")?.trim()) {
      payload.captcha = ["The captcha token is required."];
    }

    if (email && email !== testCredentials.email) {
      payload.email = ["The provided credentials are incorrect."];
    }

    if (password && password !== testCredentials.password) {
      payload.password = ["The provided credentials are incorrect."];
    }

    if (Object.keys(payload).length > 0) {
      return errorResponse(422, "ValidationException", {
        message: "The given data was invalid.",
        payload,
      });
    }

    return HttpResponse.json({
      device_session_token: createDeviceSessionToken(fingerprint),
    });
  }),

  http.post("/auth/token/issue", async ({ request }) => {
    const headerError = getRequestHeaderError(request);

    if (headerError) {
      return headerError;
    }

    const body = await getJsonBody(request);
    const token = getString(body.device_session_token);
    const fingerprint = getString(body.fingerprint);
    const payload: ValidationPayload = {};

    addRequiredFieldError(payload, "device_session_token", token);
    addRequiredFieldError(payload, "fingerprint", fingerprint);

    if (fingerprint && !isFingerprint(fingerprint)) {
      payload.fingerprint = [
        "The fingerprint must be 32 hexadecimal characters.",
      ];
    }

    if (Object.keys(payload).length > 0 || !issueSession(token, fingerprint)) {
      if (Object.keys(payload).length === 0) {
        payload.device_session_token = ["The device session token is invalid."];
      }

      return errorResponse(422, "ValidationException", {
        message: "The given data was invalid.",
        payload,
      });
    }

    return HttpResponse.json({}, { status: 200 });
  }),

  http.post("/auth/token/rotate", async ({ request }) => {
    const headerError = getRequestHeaderError(request);

    if (headerError) {
      return headerError;
    }

    const body = await getJsonBody(request);
    const fingerprint = getString(body.fingerprint);

    if (!isFingerprint(fingerprint)) {
      return errorResponse(422, "ValidationException", {
        message: "The given data was invalid.",
        payload: {
          fingerprint: ["The fingerprint must be 32 hexadecimal characters."],
        },
      });
    }

    if (!rotateSession(fingerprint)) {
      return errorResponse(400, "BadRequestException", {
        message: "Unable to rotate the session.",
      });
    }

    return HttpResponse.json({}, { status: 200 });
  }),

  http.post("/auth/token/revoke", async ({ request }) => {
    const headerError = getRequestHeaderError(request);

    if (headerError) {
      return headerError;
    }

    const body = await getJsonBody(request);
    const fingerprint = getString(body.fingerprint);

    if (!isFingerprint(fingerprint)) {
      return errorResponse(422, "ValidationException", {
        message: "The given data was invalid.",
        payload: {
          fingerprint: ["The fingerprint must be 32 hexadecimal characters."],
        },
      });
    }

    revokeSession(fingerprint);

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/v1/me", ({ request }) => {
    const headerError = getRequestHeaderError(request);

    if (headerError) {
      return headerError;
    }

    if (!hasActiveSession()) {
      return authenticationErrorResponse();
    }

    return HttpResponse.json(mockUser);
  }),

  http.get("/v1/webhooks", ({ request }) => {
    const headerError = getRequestHeaderError(request);

    if (headerError) {
      return headerError;
    }

    if (!hasActiveSession()) {
      return authenticationErrorResponse();
    }

    const url = new URL(request.url);
    const page = parsePositiveInteger(
      url.searchParams.get("page"),
      defaultPage,
    );
    const limit = parsePositiveInteger(
      url.searchParams.get("limit"),
      defaultLimit,
    );
    const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
    const filteredWebhooks = search
      ? webhooks.filter((webhook) =>
          webhook.name.toLowerCase().includes(search),
        )
      : webhooks;
    const lastPage = Math.max(1, Math.ceil(filteredWebhooks.length / limit));
    const offset = (page - 1) * limit;

    return HttpResponse.json({
      data: filteredWebhooks.slice(offset, offset + limit),
      paging: {
        pages: {
          current: page,
          last: lastPage,
        },
        results: {
          total: filteredWebhooks.length,
          limitation: limit,
        },
      },
    });
  }),

  http.get("/v1/webhooks/:id", ({ params, request }) => {
    const headerError = getRequestHeaderError(request);

    if (headerError) {
      return headerError;
    }

    if (!hasActiveSession()) {
      return authenticationErrorResponse();
    }

    const webhook = webhooks.find((item) => item.id === String(params.id));

    if (!webhook) {
      return errorResponse(404, "NotFoundException", {
        message: "Webhook not found.",
      });
    }

    return HttpResponse.json(webhook);
  }),

  http.put("/v1/webhooks/:id", async ({ params, request }) => {
    const headerError = getRequestHeaderError(request);

    if (headerError) {
      return headerError;
    }

    if (!hasActiveSession()) {
      return authenticationErrorResponse();
    }

    const webhook = webhooks.find((item) => item.id === String(params.id));

    if (!webhook) {
      return errorResponse(404, "NotFoundException", {
        message: "Webhook not found.",
      });
    }

    const body = await getJsonBody(request);
    const name = getString(body.name);
    const url = getString(body.url);
    const payload: ValidationPayload = {};

    addRequiredFieldError(payload, "name", name);
    addRequiredFieldError(payload, "url", url);

    if (url && !isHttpUrl(url)) {
      payload.url = ["The url must be a valid URL."];
    }

    if (Object.keys(payload).length > 0) {
      return errorResponse(422, "ValidationException", {
        message: "The given data was invalid.",
        payload,
      });
    }

    webhook.name = name.trim();
    webhook.url = url;

    return HttpResponse.json(webhook);
  }),
];

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
