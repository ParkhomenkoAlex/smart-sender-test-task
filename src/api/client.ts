import { clearAuthSession } from "../lib/auth-session";
import { getFingerprint } from "../lib/fingerprint";
import type { ApiErrorData } from "./types";

type HttpMethod = "GET" | "POST" | "PUT";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
  requiresAuth?: boolean;
};

type RetryState = {
  csrfRetried: boolean;
  authRetried: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly data: ApiErrorData | undefined;

  constructor(status: number, data: ApiErrorData | undefined) {
    super(data?.message ?? `Request failed with status ${status}.`);

    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  private csrfToken: string | undefined;
  private csrfPromise: Promise<string> | undefined;
  private rotatePromise: Promise<void> | undefined;
  private sessionGeneration = 0;

  async request<T>(path: string, options: RequestOptions = {}) {
    return this.send<T>(path, options, {
      csrfRetried: false,
      authRetried: false,
    });
  }

  private async send<T>(
    path: string,
    options: RequestOptions,
    retryState: RetryState,
  ): Promise<T> {
    const csrfToken = await this.ensureCsrfToken();
    const sessionGeneration = this.sessionGeneration;

    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers: this.createHeaders(options, csrfToken),
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const data = await getResponseData(response);

    if (response.ok) {
      return data as T;
    }

    const error = new ApiError(response.status, getApiErrorData(data));

    if (response.status === 419 && !retryState.csrfRetried) {
      await this.refreshCsrfToken(csrfToken);

      return this.send<T>(path, options, {
        ...retryState,
        csrfRetried: true,
      });
    }

    if (
      response.status === 401 &&
      options.requiresAuth &&
      !retryState.authRetried
    ) {
      if (sessionGeneration === this.sessionGeneration) {
        try {
          await this.rotateSession();
        } catch {
          clearAuthSession();
          throw error;
        }
      }

      return this.send<T>(path, options, {
        ...retryState,
        authRetried: true,
      });
    }

    if (response.status === 401 && options.requiresAuth) {
      clearAuthSession();
    }

    throw error;
  }

  private createHeaders(options: RequestOptions, csrfToken: string) {
    const headers = new Headers(options.headers);
    const method = options.method ?? "GET";

    headers.set("X-Requested-With", "XMLHttpRequest");

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (method === "POST" || method === "PUT") {
      headers.set("X-CSRF-TOKEN", csrfToken);
    }

    return headers;
  }

  private ensureCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return Promise.resolve(this.csrfToken);
    }

    if (this.csrfPromise) {
      return this.csrfPromise;
    }

    const promise = this.fetchCsrfToken().finally(() => {
      this.csrfPromise = undefined;
    });

    this.csrfPromise = promise;

    return promise;
  }

  private refreshCsrfToken(requestCsrfToken: string) {
    if (this.csrfToken !== requestCsrfToken) {
      return this.ensureCsrfToken();
    }

    this.csrfToken = undefined;

    return this.ensureCsrfToken();
  }

  private async fetchCsrfToken() {
    const response = await fetch("/csrf", {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!response.ok) {
      const data = await getResponseData(response);

      throw new ApiError(response.status, getApiErrorData(data));
    }

    const token = response.headers.get("X-CSRF-TOKEN");

    if (!token) {
      throw new ApiError(response.status, undefined);
    }

    this.csrfToken = token;

    return token;
  }

  private async rotateSession() {
    if (!this.rotatePromise) {
      const promise = this.request<void>("/auth/token/rotate", {
        method: "POST",
        body: {
          fingerprint: getFingerprint(),
        },
      })
        .then(() => {
          this.sessionGeneration += 1;
        })
        .finally(() => {
          this.rotatePromise = undefined;
        });

      this.rotatePromise = promise;
    }

    return this.rotatePromise;
  }
}

async function getResponseData(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function getApiErrorData(data: unknown): ApiErrorData | undefined {
  if (!isRecord(data) || !isRecord(data.error)) {
    return undefined;
  }

  const { type, message, payload } = data.error;

  if (
    typeof type !== "string" ||
    typeof message !== "string" ||
    !isValidationPayload(payload)
  ) {
    return undefined;
  }

  return {
    type,
    message,
    payload,
  };
}

function isValidationPayload(
  value: unknown,
): value is Record<string, string[]> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string"),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const apiClient = new ApiClient();
