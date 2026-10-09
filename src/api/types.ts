export type ApiErrorPayload = Record<string, string[]>;

export type ApiErrorData = {
  type: string;
  message: string;
  payload: ApiErrorPayload;
};

export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
};

export type Webhook = {
  id: string;
  name: string;
  url: string;
  active: boolean;
  created_at: string;
};

export type WebhookList = {
  data: Webhook[];
  paging: {
    pages: {
      current: number;
      last: number;
    };
    results: {
      total: number;
      limitation: number;
    };
  };
};

export type WebhookListParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type UpdateWebhookInput = {
  name: string;
  url: string;
};
