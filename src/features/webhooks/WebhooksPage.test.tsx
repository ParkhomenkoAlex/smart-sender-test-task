// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import type { Webhook, WebhookList, WebhookListParams } from "../../api/types";
import { WebhooksPage } from "./WebhooksPage";

const apiMocks = vi.hoisted(() => ({
  getWebhooks: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../api/auth", () => ({
  logout: apiMocks.logout,
}));

vi.mock("../../api/webhooks", () => ({
  getWebhooks: apiMocks.getWebhooks,
}));

const paymentWebhook: Webhook = {
  id: "wh_payment",
  name: "Payment succeeded",
  url: "https://billing.example.com/hooks/payment-succeeded",
  active: true,
  created_at: "2025-01-31T12:15:00.000Z",
};

const orderWebhook: Webhook = {
  id: "wh_order",
  name: "Order created",
  url: "https://shop.example.com/hooks/orders/created",
  active: false,
  created_at: "2025-01-27T14:15:00.000Z",
};

describe("WebhooksPage", () => {
  beforeEach(() => {
    apiMocks.getWebhooks.mockReset();
    apiMocks.logout.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows webhooks in a table after a successful load", async () => {
    apiMocks.getWebhooks.mockResolvedValue(createWebhookList([paymentWebhook]));

    renderPage();

    expect(await screen.findByText("Payment succeeded")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(apiMocks.getWebhooks).toHaveBeenCalledWith({
      limit: 10,
      page: 1,
      search: "",
    });
  });

  it("searches by name and resets the page to one", async () => {
    apiMocks.getWebhooks.mockResolvedValue(
      createWebhookList([paymentWebhook], 2, 2),
    );

    renderPage("/webhooks?page=2");

    await screen.findByText("Payment succeeded");
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Search webhooks"), {
      target: { value: "payment" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });

    expect(apiMocks.getWebhooks).toHaveBeenLastCalledWith({
      limit: 10,
      page: 2,
      search: "",
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(apiMocks.getWebhooks).toHaveBeenLastCalledWith({
      limit: 10,
      page: 1,
      search: "payment",
    });
  });

  it("loads the next server page", async () => {
    apiMocks.getWebhooks
      .mockResolvedValueOnce(createWebhookList([paymentWebhook], 1, 2))
      .mockResolvedValueOnce(createWebhookList([orderWebhook], 2, 2));

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByText("Order created")).toBeTruthy();
    expect(apiMocks.getWebhooks).toHaveBeenLastCalledWith({
      limit: 10,
      page: 2,
      search: "",
    });
  });

  it("restores page and search from a direct link", async () => {
    apiMocks.getWebhooks.mockResolvedValue(
      createWebhookList([paymentWebhook], 2, 3, 21),
    );

    renderPage("/webhooks?page=2&search=payment");

    expect(await screen.findByText("Payment succeeded")).toBeTruthy();
    expect(
      (screen.getByLabelText("Search webhooks") as HTMLInputElement).value,
    ).toBe("payment");
    expect(apiMocks.getWebhooks).toHaveBeenCalledWith({
      limit: 10,
      page: 2,
      search: "payment",
    });
  });

  it("shows a search-specific empty state", async () => {
    apiMocks.getWebhooks.mockResolvedValue(createWebhookList([], 1, 1, 0));

    renderPage("/webhooks?search=missing");

    expect(
      await screen.findByText("По вашему запросу ничего не найдено."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Очистить поиск" })).toBeTruthy();
  });

  it("shows an error and retries the request", async () => {
    apiMocks.getWebhooks
      .mockRejectedValueOnce(new Error("Request failed"))
      .mockResolvedValueOnce(createWebhookList([paymentWebhook]));

    renderPage();

    expect(
      await screen.findByText(
        "Не удалось загрузить webhooks. Попробуйте ещё раз.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Payment succeeded")).toBeTruthy();
    expect(apiMocks.getWebhooks).toHaveBeenCalledTimes(2);
  });

  it("disables pagination controls at the boundaries", async () => {
    apiMocks.getWebhooks.mockResolvedValue(
      createWebhookList([paymentWebhook], 1, 1),
    );

    renderPage();

    expect(
      (
        (await screen.findByRole("button", {
          name: "Previous",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("restores page and search when navigating back and forward", async () => {
    apiMocks.getWebhooks.mockImplementation(({ page = 1 }: WebhookListParams) =>
      Promise.resolve(
        createWebhookList(
          [page === 1 ? paymentWebhook : orderWebhook],
          page,
          2,
          11,
        ),
      ),
    );

    renderPage("/webhooks?search=payment");

    expect(await screen.findByText("Payment succeeded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Order created")).toBeTruthy();
    expect(
      (screen.getByLabelText("Search webhooks") as HTMLInputElement).value,
    ).toBe("payment");

    fireEvent.click(screen.getByRole("button", { name: "History back" }));

    expect(await screen.findByText("Payment succeeded")).toBeTruthy();
    expect(
      (screen.getByLabelText("Search webhooks") as HTMLInputElement).value,
    ).toBe("payment");

    fireEvent.click(screen.getByRole("button", { name: "History forward" }));

    expect(await screen.findByText("Order created")).toBeTruthy();
  });

  it("opens the matching edit route", async () => {
    apiMocks.getWebhooks.mockResolvedValue(createWebhookList([paymentWebhook]));

    renderPage();

    fireEvent.click(await screen.findByRole("link", { name: "Edit" }));

    expect((await screen.findByTestId("location")).textContent).toBe(
      "/webhooks/wh_payment",
    );
  });
});

function renderPage(path = "/webhooks") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/webhooks"
            element={
              <>
                <WebhooksPage />
                <HistoryControls />
              </>
            }
          />
          <Route path="/webhooks/:id" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function createWebhookList(
  data: Webhook[],
  current = 1,
  last = 1,
  total = data.length,
): WebhookList {
  return {
    data,
    paging: {
      pages: {
        current,
        last,
      },
      results: {
        total,
        limitation: 10,
      },
    },
  };
}

function LocationDisplay() {
  const location = useLocation();

  return <p data-testid="location">{location.pathname}</p>;
}

function HistoryControls() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        History back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        History forward
      </button>
    </>
  );
}
