# Smart Sender Test Task

A small React application for authenticating a user, browsing webhooks, and editing webhook endpoints. It uses an in-browser MSW mock API that follows the task contract.

**Live Demo:** https://smart-sender-test-task.vercel.app/

## Features

- Email and password login with protected routes and logout.
- Server-side webhook search and pagination with URL-synchronised state.
- Webhook details editing with client- and server-side validation feedback.
- Session renewal, CSRF handling, loading, empty, error, and retry states.

## Tech Stack

- React and TypeScript
- Vite and Tailwind CSS
- React Router
- TanStack Query
- React Hook Form and Zod
- MSW
- Vitest and React Testing Library

## Prerequisites

- Node.js
- pnpm

## Getting Started

```bash
pnpm install
pnpm dev
```

## Demo Credentials

- Email: `senior@smart-sender.test`
- Password: `SmartSender2026!`

## Available Scripts

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Start the Vite development server.                |
| `pnpm build`        | Type-check and build the production bundle.       |
| `pnpm lint`         | Run ESLint.                                       |
| `pnpm test`         | Run the Vitest suite.                             |
| `pnpm preview`      | Preview the production build.                     |
| `pnpm format`       | Format project files with Prettier.               |
| `pnpm format:check` | Check formatting with Prettier.                   |
| `pnpm check`        | Run formatting, linting, tests, and build checks. |

## Authentication and Security

The login flow exchanges credentials for a `device_session_token`, then issues a server-side session and loads the current user. The device session token is kept only in memory; it is not written to `localStorage` or the URL.

A stable 32-character device fingerprint is generated once and stored in `localStorage`. It is included in authentication requests. Session state is held by the mock API, similarly to an HttpOnly-cookie-backed session.

Protected requests that receive `401` share a single token-rotation request, then retry once. A failed rotation or a repeated `401` clears the local session. Logout calls the revoke endpoint and clears the in-memory token and React Query cache.

Before API requests, the client obtains a CSRF token from `GET /csrf`. Every request includes `X-Requested-With: XMLHttpRequest`; `POST` and `PUT` requests also include `X-CSRF-TOKEN`. A `419` response refreshes the token and retries the original request once.

## Webhooks

The webhook list provides server-side name search, a 300 ms debounce, and pagination with 10 records per page. The `search` and `page` parameters are stored in the URL, so direct links and browser Back/Forward navigation restore the list state.

Each row links to an edit page. The edit form supports the contract fields `name` and `url`, validates required values and HTTP/HTTPS URLs, and shows validation errors returned by the API next to the relevant field. Returning to the list preserves its current URL parameters.

## Mock API

MSW runs in the browser and handles authentication, CSRF, user, and webhook endpoints. It provides one fixed demo user and 27 stable webhook records. Sessions, device tokens, and webhook updates are stored in memory only, so reloading the application may require signing in again and resets mock data.

## Testing

The test suite uses Vitest and React Testing Library. It covers authentication UI and route protection, single-flight token rotation, CSRF request and retry behaviour, logout cleanup, webhook list search/pagination/URL state, and webhook editing, validation, save errors, and navigation.

## Architecture Decisions

- API transport is isolated in `src/api`, including CSRF and session-retry behaviour.
- Feature UI and TanStack Query state live under `src/features`.
- MSW handlers and in-memory mock state live under `src/mocks`.
- The implementation stays intentionally small: no extra component library, global state layer, or backend is required for this task.
