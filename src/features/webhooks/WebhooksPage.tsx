import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { logout } from "../../api/auth";

export function WebhooksPage() {
  const navigate = useNavigate();
  const isLogoutRequested = useRef(false);
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      navigate("/login", { replace: true });
    },
  });
  const handleLogout = () => {
    if (isLogoutRequested.current) {
      return;
    }

    isLogoutRequested.current = true;
    logoutMutation.mutate();
  };

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Webhooks</h1>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={logoutMutation.isPending}
          onClick={handleLogout}
        >
          {logoutMutation.isPending ? "Выходим…" : "Logout"}
        </button>
      </header>
      <p className="mt-6 text-slate-600">
        Список вебхуков будет добавлен позже.
      </p>
    </main>
  );
}
