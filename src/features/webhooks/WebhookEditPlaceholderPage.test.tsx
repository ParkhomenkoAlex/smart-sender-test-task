// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ApiError } from "../../api/client";
import type { Webhook } from "../../api/types";
import { WebhookEditPage } from "./WebhookEditPlaceholderPage";

const apiMocks = vi.hoisted(() => ({
  getWebhook: vi.fn(),
  updateWebhook: vi.fn(),
}));

vi.mock("../../api/webhooks", () => ({
  getWebhook: apiMocks.getWebhook,
  updateWebhook: apiMocks.updateWebhook,
}));

const webhook: Webhook = {
  id: "wh_payment",
  name: "Payment succeeded",
  url: "https://billing.example.com/hooks/payment-succeeded",
  active: true,
  created_at: "2025-01-31T12:15:00.000Z",
};

describe("WebhookEditPage", () => {
  beforeEach(() => {
    apiMocks.getWebhook.mockReset();
    apiMocks.updateWebhook.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads a webhook and fills the form", async () => {
    apiMocks.getWebhook.mockResolvedValue(webhook);

    renderPage();

    expect(
      ((await screen.findByLabelText("Name")) as HTMLInputElement).value,
    ).toBe(webhook.name);
    expect((screen.getByLabelText("URL") as HTMLInputElement).value).toBe(
      webhook.url,
    );
    expect(apiMocks.getWebhook).toHaveBeenCalledWith(webhook.id);
  });

  it("shows a loading state", () => {
    apiMocks.getWebhook.mockReturnValue(new Promise<Webhook>(() => {}));

    renderPage();

    expect(screen.getByRole("status").textContent).toBe("Loading webhook…");
  });

  it("shows an error when the webhook cannot be loaded", async () => {
    apiMocks.getWebhook.mockRejectedValue(new Error("Request failed"));

    renderPage();

    expect(
      await screen.findByText("Unable to load webhook. Please try again."),
    ).toBeTruthy();
  });

  it("shows a not found state for a missing webhook", async () => {
    apiMocks.getWebhook.mockRejectedValue(
      new ApiError(404, {
        type: "NotFoundException",
        message: "Webhook not found.",
        payload: {},
      }),
    );

    renderPage("/webhooks/missing");

    expect(
      await screen.findByRole("heading", { name: "Webhook not found" }),
    ).toBeTruthy();
  });

  it("does not submit invalid form data", async () => {
    apiMocks.getWebhook.mockResolvedValue(webhook);

    renderPage();

    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a name.")).toBeTruthy();
    expect(apiMocks.updateWebhook).not.toHaveBeenCalled();
  });

  it("saves valid data and returns to the filtered list", async () => {
    const updatedWebhook = { ...webhook, name: "Payment completed" };
    apiMocks.getWebhook.mockResolvedValue(webhook);
    apiMocks.updateWebhook.mockResolvedValue(updatedWebhook);

    renderPage(`/webhooks/${webhook.id}?page=2&search=payment`);

    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: updatedWebhook.name },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect((await screen.findByTestId("location")).textContent).toBe(
      "/webhooks?page=2&search=payment",
    );
    expect(apiMocks.updateWebhook).toHaveBeenCalledWith(webhook.id, {
      name: updatedWebhook.name,
      url: webhook.url,
    });
  });

  it("shows a server validation error beside the matching field", async () => {
    apiMocks.getWebhook.mockResolvedValue(webhook);
    apiMocks.updateWebhook.mockRejectedValue(
      new ApiError(422, {
        type: "ValidationException",
        message: "The given data was invalid.",
        payload: {
          url: ["The url must be a valid URL."],
        },
      }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("The url must be a valid URL."),
    ).toBeTruthy();
  });

  it("shows a save error", async () => {
    apiMocks.getWebhook.mockResolvedValue(webhook);
    apiMocks.updateWebhook.mockRejectedValue(new Error("Request failed"));

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Unable to save webhook. Please try again."),
    ).toBeTruthy();
  });

  it("cancels without saving and keeps list parameters", async () => {
    apiMocks.getWebhook.mockResolvedValue(webhook);

    renderPage(`/webhooks/${webhook.id}?page=2&search=payment`);

    fireEvent.click(await screen.findByRole("link", { name: "Cancel" }));

    expect((await screen.findByTestId("location")).textContent).toBe(
      "/webhooks?page=2&search=payment",
    );
    expect(apiMocks.updateWebhook).not.toHaveBeenCalled();
  });
});

function renderPage(path = `/webhooks/${webhook.id}`) {
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
          <Route path="/webhooks/:id" element={<WebhookEditPage />} />
          <Route path="/webhooks" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationDisplay() {
  const location = useLocation();

  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}
    </p>
  );
}
