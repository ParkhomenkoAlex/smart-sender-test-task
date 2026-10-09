import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { getWebhook, updateWebhook } from "../../api/webhooks";
import type { UpdateWebhookInput, Webhook } from "../../api/types";

const webhookSchema = z.object({
  name: z.string().trim().min(1, "Введите название."),
  url: z
    .string()
    .trim()
    .min(1, "Введите URL.")
    .url("Введите корректный URL.")
    .refine(isHttpUrl, "Введите корректный HTTP/HTTPS URL."),
});

export function WebhookEditPage() {
  const { id } = useParams();
  const location = useLocation();
  const backTo = `/webhooks${location.search}`;
  const webhookQuery = useQuery({
    queryKey: ["webhook", id],
    queryFn: () => getWebhook(id ?? ""),
    enabled: Boolean(id),
    retry: false,
  });

  if (!id || isNotFoundError(webhookQuery.error)) {
    return <WebhookNotFoundState backTo={backTo} />;
  }

  if (webhookQuery.isPending) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-slate-600" role="status">
          Загружаем webhook…
        </p>
      </main>
    );
  }

  if (webhookQuery.isError || !webhookQuery.data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <section className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800" role="alert">
            Не удалось загрузить webhook. Попробуйте ещё раз.
          </p>
          <button
            className="mt-3 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            type="button"
            onClick={() => webhookQuery.refetch()}
          >
            Retry
          </button>
        </section>
        <BackToWebhooks to={backTo} />
      </main>
    );
  }

  return (
    <WebhookEditForm
      key={webhookQuery.data.id}
      webhook={webhookQuery.data}
      backTo={backTo}
    />
  );
}

type WebhookEditFormProps = {
  webhook: Webhook;
  backTo: string;
};

function WebhookEditForm({ webhook, backTo }: WebhookEditFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UpdateWebhookInput>({
    defaultValues: {
      name: webhook.name,
      url: webhook.url,
    },
    resolver: zodResolver(webhookSchema),
  });
  const updateMutation = useMutation({
    mutationFn: (input: UpdateWebhookInput) => updateWebhook(webhook.id, input),
    onSuccess: (updatedWebhook) => {
      queryClient.setQueryData(["webhook", updatedWebhook.id], updatedWebhook);
      void queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      navigate(backTo, { replace: true });
    },
    onError: (error) => {
      applyFieldErrors(error, setError);
    },
  });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Edit webhook</h1>
        <p className="mt-2 text-sm text-slate-600">{webhook.id}</p>
      </header>
      <BackToWebhooks to={backTo} />

      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={handleSubmit((input) => updateMutation.mutate(input))}
      >
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
            type="text"
            aria-invalid={errors.name ? "true" : "false"}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
        </label>
        {errors.name && (
          <p className="text-sm text-red-700" id="name-error" role="alert">
            {errors.name.message}
          </p>
        )}

        <label className="block text-sm font-medium text-slate-700">
          URL
          <input
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
            type="url"
            aria-invalid={errors.url ? "true" : "false"}
            aria-describedby={errors.url ? "url-error" : undefined}
            {...register("url")}
          />
        </label>
        {errors.url && (
          <p className="text-sm text-red-700" id="url-error" role="alert">
            {errors.url.message}
          </p>
        )}

        {getSaveErrorMessage(updateMutation.error) && (
          <p className="text-sm text-red-700" role="alert">
            {getSaveErrorMessage(updateMutation.error)}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Сохраняем…" : "Save"}
          </button>
          <Link
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            to={backTo}
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}

function WebhookNotFoundState({ backTo }: { backTo: string }) {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <section className="rounded-md border border-slate-200 p-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Webhook not found
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Запрошенный webhook не существует.
        </p>
      </section>
      <BackToWebhooks to={backTo} />
    </main>
  );
}

function BackToWebhooks({ to }: { to: string }) {
  return (
    <Link
      className="mt-6 inline-block text-sm font-medium text-sky-700 hover:text-sky-800"
      to={to}
    >
      Back to Webhooks
    </Link>
  );
}

function applyFieldErrors(
  error: unknown,
  setError: ReturnType<typeof useForm<UpdateWebhookInput>>["setError"],
) {
  if (!(error instanceof ApiError)) {
    return;
  }

  const nameError = error.data?.payload.name?.[0];
  const urlError = error.data?.payload.url?.[0];

  if (nameError) {
    setError("name", { message: nameError });
  }

  if (urlError) {
    setError("url", { message: urlError });
  }
}

function getSaveErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 422) {
    return undefined;
  }

  return error
    ? "Не удалось сохранить webhook. Попробуйте ещё раз."
    : undefined;
}

function isNotFoundError(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
