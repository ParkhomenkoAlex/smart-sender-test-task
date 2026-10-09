import { queryClient } from "../app/queryClient";

let deviceSessionToken: string | undefined;

export function setDeviceSessionToken(token: string) {
  deviceSessionToken = token;
}

export function hasDeviceSessionToken() {
  return deviceSessionToken !== undefined;
}

export function clearAuthSession() {
  deviceSessionToken = undefined;
  queryClient.clear();
}
