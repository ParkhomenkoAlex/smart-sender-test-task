import {
  clearAuthSession,
  hasDeviceSessionToken,
  setDeviceSessionToken,
} from "../lib/auth-session";
import { getFingerprint } from "../lib/fingerprint";
import { apiClient } from "./client";
import type { User } from "./types";

type LoginResponse = {
  device_session_token: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export async function login({ email, password }: LoginInput) {
  const fingerprint = getFingerprint();
  const loginResponse = await apiClient.request<LoginResponse>("/auth/login", {
    method: "POST",
    headers: {
      "X-Captcha-Token": "mock-captcha-token",
    },
    body: {
      email,
      password,
      fingerprint,
    },
  });

  setDeviceSessionToken(loginResponse.device_session_token);

  try {
    await apiClient.request<void>("/auth/token/issue", {
      method: "POST",
      body: {
        device_session_token: loginResponse.device_session_token,
        fingerprint,
      },
    });

    return getCurrentUser();
  } catch (error) {
    clearAuthSession();
    throw error;
  }
}

export function getCurrentUser() {
  return apiClient.request<User>("/v1/me", {
    requiresAuth: true,
  });
}

export async function logout() {
  try {
    await apiClient.request<void>("/auth/token/revoke", {
      method: "POST",
      body: {
        fingerprint: getFingerprint(),
      },
    });
  } finally {
    clearAuthSession();
  }
}

export { hasDeviceSessionToken };
