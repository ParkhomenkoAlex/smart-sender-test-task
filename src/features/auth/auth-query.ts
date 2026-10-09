import { useQuery } from "@tanstack/react-query";
import { getCurrentUser, hasDeviceSessionToken } from "../../api/auth";

export const authUserQueryKey = ["auth", "user"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: authUserQueryKey,
    queryFn: getCurrentUser,
    enabled: hasDeviceSessionToken(),
    retry: false,
    staleTime: Infinity,
  });
}
