import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { login } from "../../api/auth";
import { ApiError } from "../../api/client";
import { authUserQueryKey } from "./auth-query";

const loginSchema = z.object({
  email: z.string().min(1, "Введите email.").email("Введите корректный email."),
  password: z.string().min(1, "Введите пароль."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(authUserQueryKey, user);
      navigate("/webhooks", { replace: true });
    },
    onError: (error) => {
      applyFieldErrors(error, setError);
    },
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
      <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Smart Sender — Webhooks
        </h1>
        <p className="mt-2 text-sm text-slate-600">Войдите в аккаунт.</p>

        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={handleSubmit((values) => loginMutation.mutate(values))}
        >
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
          </label>
          {errors.email && (
            <p className="text-sm text-red-700" id="email-error" role="alert">
              {errors.email.message}
            </p>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Пароль
            <input
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
          </label>
          {errors.password && (
            <p
              className="text-sm text-red-700"
              id="password-error"
              role="alert"
            >
              {errors.password.message}
            </p>
          )}

          {loginMutation.isError && (
            <p className="text-sm text-red-700" role="alert">
              {getLoginErrorMessage(loginMutation.error)}
            </p>
          )}

          <button
            className="w-full rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Выполняется вход…" : "Войти"}
          </button>
        </form>
      </section>
    </main>
  );
}

function applyFieldErrors(
  error: unknown,
  setError: ReturnType<typeof useForm<LoginFormValues>>["setError"],
) {
  if (!(error instanceof ApiError)) {
    return;
  }

  const emailError = error.data?.payload.email?.[0];
  const passwordError = error.data?.payload.password?.[0];

  if (emailError) {
    setError("email", { message: emailError });
  }

  if (passwordError) {
    setError("password", { message: passwordError });
  }
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return (
      error.data?.message ?? "Не удалось выполнить вход. Попробуйте ещё раз."
    );
  }

  return "Не удалось выполнить вход. Проверьте подключение к интернету.";
}
