import { Link, useParams } from "react-router-dom";

export function WebhookEditPlaceholderPage() {
  const { id } = useParams();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Edit webhook</h1>
      <p className="mt-3 text-slate-600">
        Редактирование webhook {id} будет добавлено позже.
      </p>
      <Link
        className="mt-6 inline-block text-sm font-medium text-sky-700 hover:text-sky-800"
        to="/webhooks"
      >
        Вернуться к списку
      </Link>
    </main>
  );
}
