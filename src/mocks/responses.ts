import { HttpResponse } from "msw";
import type { ApiErrorType, ValidationPayload } from "./types";

type ApiErrorOptions = {
  message: string;
  payload?: ValidationPayload;
};

export function errorResponse(
  status: number,
  type: ApiErrorType,
  { message, payload = {} }: ApiErrorOptions,
) {
  return HttpResponse.json(
    {
      error: {
        type,
        message,
        payload,
      },
    },
    { status },
  );
}

export function csrfErrorResponse() {
  return errorResponse(419, "TokenMismatchException", {
    message: "CSRF token mismatch.",
  });
}

export function authenticationErrorResponse() {
  return errorResponse(401, "AuthenticationException", {
    message: "Unauthenticated.",
  });
}
