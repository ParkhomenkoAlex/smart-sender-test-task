export type Webhook = {
  id: string;
  name: string;
  url: string;
  active: boolean;
  created_at: string;
};

export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
};

export type ValidationPayload = Record<string, string[]>;

export type ApiErrorType =
  | "BadRequestException"
  | "AuthenticationException"
  | "NotFoundException"
  | "TokenMismatchException"
  | "ValidationException";
