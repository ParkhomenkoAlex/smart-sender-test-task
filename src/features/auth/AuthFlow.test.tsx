// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "../../app/App";
import { ApiError } from "../../api/client";
import { authUserQueryKey } from "./auth-query";

const authMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  hasSession: false,
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../api/auth", () => ({
  getCurrentUser: authMocks.getCurrentUser,
  hasDeviceSessionToken: () => authMocks.hasSession,
  login: authMocks.login,
  logout: authMocks.logout,
}));

const user = {
  id: "usr_01",
  email: "senior@smart-sender.test",
  first_name: "Olena",
  last_name: "Koval",
  name: "Olena Koval",
};

describe("Auth UI", () => {
  beforeEach(() => {
    authMocks.getCurrentUser.mockReset();
    authMocks.login.mockReset();
    authMocks.logout.mockReset();
    authMocks.hasSession = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("does not submit invalid email and empty password", async () => {
    renderApp("/login");

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "invalid-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeTruthy();
    expect(await screen.findByText("Enter a password.")).toBeTruthy();
    expect(authMocks.login).not.toHaveBeenCalled();
  });

  it("redirects to webhooks after a successful login", async () => {
    authMocks.login.mockImplementation(async () => {
      authMocks.hasSession = true;

      return user;
    });
    renderApp("/login");

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "SmartSender2026!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Webhooks" }),
    ).toBeTruthy();
  });

  it("shows a login error without opening the protected page", async () => {
    authMocks.login.mockRejectedValue(
      new ApiError(422, {
        type: "ValidationException",
        message: "The given data was invalid.",
        payload: {
          password: ["The provided credentials are incorrect."],
        },
      }),
    );
    renderApp("/login");

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("The provided credentials are incorrect."),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Webhooks" })).toBeNull();
  });

  it("redirects an unauthenticated user from webhooks to login", async () => {
    renderApp("/webhooks");

    expect(
      await screen.findByRole("heading", {
        name: "Smart Sender — Webhooks",
      }),
    ).toBeTruthy();
  });

  it("logs out and returns to login", async () => {
    authMocks.hasSession = true;
    authMocks.logout.mockImplementation(async () => {
      authMocks.hasSession = false;
    });
    renderApp("/webhooks", true);

    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(authMocks.logout).toHaveBeenCalledOnce();
    });
    expect(
      await screen.findByRole("heading", {
        name: "Smart Sender — Webhooks",
      }),
    ).toBeTruthy();
  });
});

function renderApp(path: string, authenticated = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  if (authenticated) {
    queryClient.setQueryData(authUserQueryKey, user);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
