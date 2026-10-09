import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("apiClient token rotation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
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
});

function resolveInitialRequests(
  initialRequestCount: number,
  initialRequestsStarted: Deferred<void>,
) {
  if (initialRequestCount === 2) {
    initialRequestsStarted.resolve();
  }
}
