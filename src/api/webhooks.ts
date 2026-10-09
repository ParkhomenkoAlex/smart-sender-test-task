import { apiClient } from "./client";
import type {
  UpdateWebhookInput,
  Webhook,
  WebhookList,
  WebhookListParams,
} from "./types";

export function getWebhooks({
  page = 1,
  limit = 10,
  search = "",
}: WebhookListParams = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
  });

  return apiClient.request<WebhookList>(`/v1/webhooks?${query}`, {
    requiresAuth: true,
  });
}

export function getWebhook(id: string) {
  return apiClient.request<Webhook>(`/v1/webhooks/${id}`, {
    requiresAuth: true,
  });
}

export function updateWebhook(id: string, input: UpdateWebhookInput) {
  return apiClient.request<Webhook>(`/v1/webhooks/${id}`, {
    method: "PUT",
    body: input,
    requiresAuth: true,
  });
}
