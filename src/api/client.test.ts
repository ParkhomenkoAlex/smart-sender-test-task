import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fingerprint = "a".repeat(32);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
}

function createResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
  });
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => fingerprint),
      setItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("retries two protected requests after one rotation when the second 401 arrives late", async () => {
    const initialRequestsStarted = createDeferred<void>();
    const rotateStarted = createDeferred<void>();
    const firstRequestRetried = createDeferred<void>();
    const secondRequestRetried = createDeferred<void>();
    const firstInitialResponse = createDeferred<Response>();
    const secondInitialResponse = createDeferred<Response>();
    const rotateResponse = createDeferred<Response>();
    let initialRequestCount = 0;
    let firstRequestCount = 0;
    let secondRequestCount = 0;
    let rotateRequestCount = 0;

    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url === "/csrf") {
          return Promise.resolve(
            new Response(null, {
              status: 204,
              headers: {
                "X-CSRF-TOKEN": "csrf-token",
              },
            }),
          );
        }

        if (url === "/auth/token/rotate") {
          expect(init?.method).toBe("POST");
          rotateRequestCount += 1;
          rotateStarted.resolve();

          return rotateResponse.promise;
        }

        if (url === "/v1/webhooks/wh_001") {
          firstRequestCount += 1;

          if (firstRequestCount === 1) {
            initialRequestCount += 1;
            resolveInitialRequests(initialRequestCount, initialRequestsStarted);

            return firstInitialResponse.promise;
          }

          firstRequestRetried.resolve();

          return Promise.resolve(createResponse(200, { id: "wh_001" }));
        }

        if (url === "/v1/webhooks/wh_002") {
          secondRequestCount += 1;

          if (secondRequestCount === 1) {
            initialRequestCount += 1;
            resolveInitialRequests(initialRequestCount, initialRequestsStarted);

            return secondInitialResponse.promise;
          }

          secondRequestRetried.resolve();

          return Promise.resolve(createResponse(200, { id: "wh_002" }));
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const { getWebhook } = await import("./webhooks");
    const firstRequest = getWebhook("wh_001");
    const secondRequest = getWebhook("wh_002");

    await initialRequestsStarted.promise;

    firstInitialResponse.resolve(createResponse(401));
    await rotateStarted.promise;

    rotateResponse.resolve(createResponse(200, {}));
    await firstRequestRetried.promise;

    secondInitialResponse.resolve(createResponse(401));
    await secondRequestRetried.promise;

    await Promise.all([firstRequest, secondRequest]);

    expect(rotateRequestCount).toBe(1);
    expect(firstRequestCount).toBe(2);
    expect(secondRequestCount).toBe(2);
  });

  it("sends CSRF and XMLHttpRequest headers for auth POST and webhook PUT requests", async () => {
    const csrfToken = "csrf-token";
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url === "/csrf") {
          return Promise.resolve(createCsrfResponse(csrfToken));
        }

        const headers = new Headers(init?.headers);

        expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
        expect(headers.get("X-CSRF-TOKEN")).toBe(csrfToken);
        expect(headers.get("Content-Type")).toBe("application/json");

        if (url === "/auth/token/revoke") {
          expect(init?.method).toBe("POST");
          expect(init?.body).toBe(JSON.stringify({ fingerprint }));

          return Promise.resolve(createResponse(204));
        }

        if (url === "/v1/webhooks/wh_001") {
          expect(init?.method).toBe("PUT");
          expect(init?.body).toBe(
            JSON.stringify({
              name: "Payment succeeded",
              url: "https://billing.example.com/webhooks/payment-succeeded",
            }),
          );

          return Promise.resolve(createResponse(200, {}));
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const { updateWebhook } = await import("./webhooks");
    const { logout } = await import("./auth");

    await logout();
    await updateWebhook("wh_001", {
      name: "Payment succeeded",
      url: "https://billing.example.com/webhooks/payment-succeeded",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes the CSRF token and retries a request once after a 419 response", async () => {
    const csrfTokens = ["csrf-token-one", "csrf-token-two"];
    let csrfRequestCount = 0;
    let updateRequestCount = 0;
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url === "/csrf") {
          const token = csrfTokens[csrfRequestCount];

          csrfRequestCount += 1;

          return Promise.resolve(createCsrfResponse(token));
        }

        if (url === "/v1/webhooks/wh_001") {
          const headers = new Headers(init?.headers);

          expect(headers.get("X-CSRF-TOKEN")).toBe(
            csrfTokens[updateRequestCount],
          );
          updateRequestCount += 1;

          if (updateRequestCount === 1) {
            return Promise.resolve(
              createResponse(419, {
                error: {
                  type: "TokenMismatchException",
                  message: "CSRF token mismatch.",
                  payload: {},
                },
              }),
            );
          }

          return Promise.resolve(createResponse(200, { id: "wh_001" }));
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const { updateWebhook } = await import("./webhooks");

    await updateWebhook("wh_001", {
      name: "Payment succeeded",
      url: "https://billing.example.com/webhooks/payment-succeeded",
    });

    expect(csrfRequestCount).toBe(2);
    expect(updateRequestCount).toBe(2);
  });

  it("clears the in-memory session and user cache after logout", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url === "/csrf") {
        return Promise.resolve(createCsrfResponse("csrf-token"));
      }

      if (url === "/auth/token/revoke") {
        return Promise.resolve(createResponse(204));
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { queryClient } = await import("../app/queryClient");
    const { logout, hasDeviceSessionToken } = await import("./auth");
    const { setDeviceSessionToken } = await import("../lib/auth-session");

    setDeviceSessionToken("device-session-token");
    queryClient.setQueryData(["auth", "user"], { id: "usr_001" });

    await logout();

    expect(hasDeviceSessionToken()).toBe(false);
    expect(queryClient.getQueryData(["auth", "user"])).toBeUndefined();
  });
});

function createCsrfResponse(token: string) {
  return new Response(null, {
    status: 204,
    headers: {
      "X-CSRF-TOKEN": token,
    },
  });
}

function resolveInitialRequests(
  initialRequestCount: number,
  initialRequestsStarted: Deferred<void>,
) {
  if (initialRequestCount === 2) {
    initialRequestsStarted.resolve();
  }
}
