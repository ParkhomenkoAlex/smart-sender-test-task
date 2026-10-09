import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { logout } from "../../api/auth";
import { getWebhooks } from "../../api/webhooks";
import type { Webhook } from "../../api/types";

export function WebhooksPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const page = getPage(searchParams.get("page"));
  const isLogoutRequested = useRef(false);
  const updateSearchParams = useCallback(
    (nextPage: number, nextSearch: string, replace = false) => {
      setSearchParams(createSearchParams(nextPage, nextSearch), { replace });
    },
    [setSearchParams],
  );
  const handleSearchChange = useCallback(
    (nextSearch: string) => {
      updateSearchParams(1, nextSearch, true);
    },
    [updateSearchParams],
  );
  const webhooksQuery = useQuery({
    queryKey: ["webhooks", { page, search: urlSearch }],
    queryFn: () =>
      getWebhooks({
        page,
        limit: 10,
        search: urlSearch,
      }),
    retry: false,
  });
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

  useEffect(() => {
    if (searchParams.has("page") && searchParams.get("page") !== String(page)) {
      updateSearchParams(1, urlSearch, true);
    }
  }, [page, searchParams, updateSearchParams, urlSearch]);

  useEffect(() => {
    const lastPage = webhooksQuery.data?.paging.pages.last;

    if (lastPage && page > lastPage) {
      updateSearchParams(lastPage, urlSearch, true);
    }
  }, [page, updateSearchParams, urlSearch, webhooksQuery.data]);

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

      <section className="mt-6">
        <WebhookSearch
          key={urlSearch}
          search={urlSearch}
          onSearchChange={handleSearchChange}
        />
      </section>

      {webhooksQuery.isPending && (
        <p className="mt-6 text-sm text-slate-600" role="status">
          Загружаем webhooks…
        </p>
      )}

      {!webhooksQuery.isPending && webhooksQuery.isFetching && (
        <p className="mt-6 text-sm text-slate-600" role="status">
          Ищем webhooks…
        </p>
      )}

      {webhooksQuery.isError && (
        <section className="mt-6 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800" role="alert">
            Не удалось загрузить webhooks. Попробуйте ещё раз.
          </p>
          <button
            className="mt-3 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            type="button"
            onClick={() => webhooksQuery.refetch()}
          >
            Retry
          </button>
        </section>
      )}

      {webhooksQuery.data &&
        page <= webhooksQuery.data.paging.pages.last &&
        (webhooksQuery.data.data.length > 0 ? (
          <>
            <WebhookTable
              webhooks={webhooksQuery.data.data}
              listSearch={location.search}
            />
            <Pagination
              currentPage={webhooksQuery.data.paging.pages.current}
              lastPage={webhooksQuery.data.paging.pages.last}
              total={webhooksQuery.data.paging.results.total}
              onPageChange={(nextPage) =>
                updateSearchParams(nextPage, urlSearch)
              }
            />
          </>
        ) : (
          <EmptyState
            hasSearch={Boolean(urlSearch)}
            onClearSearch={() => {
              handleSearchChange("");
            }}
          />
        ))}
    </main>
  );
}

type WebhookSearchProps = {
  search: string;
  onSearchChange: (search: string) => void;
};

function WebhookSearch({ search, onSearchChange }: WebhookSearchProps) {
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    const normalizedSearch = searchInput.trim();

    if (normalizedSearch === search) {
      return;
    }

    const timer = window.setTimeout(() => {
      onSearchChange(normalizedSearch);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [onSearchChange, search, searchInput]);

  return (
    <label className="block max-w-md text-sm font-medium text-slate-700">
      Search webhooks
      <input
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
        type="search"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
      />
    </label>
  );
}

type WebhookTableProps = {
  webhooks: Webhook[];
  listSearch: string;
};

function WebhookTable({ webhooks, listSearch }: WebhookTableProps) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">URL</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created at</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {webhooks.map((webhook) => (
            <tr key={webhook.id}>
              <td className="max-w-52 px-4 py-3 font-medium text-slate-900">
                <span className="block truncate" title={webhook.name}>
                  {webhook.name}
                </span>
              </td>
              <td className="max-w-xs break-all px-4 py-3 text-slate-600">
                {webhook.url}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    webhook.active
                      ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                      : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                  }
                >
                  {webhook.active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDate(webhook.created_at)}
              </td>
              <td className="px-4 py-3">
                <Link
                  className="font-medium text-sky-700 hover:text-sky-800"
                  to={`/webhooks/${webhook.id}${listSearch}`}
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PaginationProps = {
  currentPage: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
};

function Pagination({
  currentPage,
  lastPage,
  total,
  onPageChange,
}: PaginationProps) {
  return (
    <section
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
      aria-label="Pagination"
    >
      <p className="text-sm text-slate-600">
        Страница {currentPage} из {lastPage}. Найдено: {total}.
      </p>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={currentPage === lastPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}

type EmptyStateProps = {
  hasSearch: boolean;
  onClearSearch: () => void;
};

function EmptyState({ hasSearch, onClearSearch }: EmptyStateProps) {
  if (hasSearch) {
    return (
      <section className="mt-6 rounded-md border border-slate-200 p-6">
        <p className="text-slate-700">По вашему запросу ничего не найдено.</p>
        <button
          className="mt-3 text-sm font-medium text-sky-700 hover:text-sky-800"
          type="button"
          onClick={onClearSearch}
        >
          Очистить поиск
        </button>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-md border border-slate-200 p-6">
      <p className="text-slate-700">Webhooks пока нет.</p>
    </section>
  );
}

function getPage(value: string | null) {
  if (!value) {
    return 1;
  }

  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function createSearchParams(page: number, search: string) {
  const nextSearchParams = new URLSearchParams();

  if (page > 1) {
    nextSearchParams.set("page", String(page));
  }

  if (search) {
    nextSearchParams.set("search", search);
  }

  return nextSearchParams;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
