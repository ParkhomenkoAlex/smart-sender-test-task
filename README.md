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

## Production QA Checklist

Production URL: https://smart-sender-test-task.vercel.app/

### 1. Application Startup

- [ ] Production URL opens without 404/500 errors or a blank screen.
- [ ] Login page renders correctly.
- [ ] All UI text is in English.
- [ ] Browser Console has no unexpected JavaScript errors.
- [ ] Network has no unexpected JS/CSS or MSW worker loading errors.

### 2. Login

- [ ] Empty fields show required validation.
- [ ] Invalid email shows validation.
- [ ] Incorrect credentials show an authentication error.
- [ ] Valid credentials successfully authenticate.
- [ ] Successful login redirects to Webhooks.
- [ ] Repeated clicks during loading do not create duplicate requests.

### 3. Protected Routes

- [ ] Direct unauthenticated access to Webhooks redirects to Login.
- [ ] Direct unauthenticated access to an existing Webhook Edit URL redirects to Login.
- [ ] Authenticated users can access protected pages.
- [ ] Client-side navigation preserves the session.
- [ ] Full page reload clears the in-memory session and requires login again.

### 4. Webhooks List

- [ ] Webhooks load successfully.
- [ ] Loading finishes correctly.
- [ ] Webhook names, URLs, and other implemented fields render correctly.
- [ ] First page contains no more than 10 items.
- [ ] Next and Previous pagination work.
- [ ] Next is disabled on the last page.
- [ ] Switching pages shows the correct data.

### 5. Search and URL State

- [ ] Searching an existing webhook returns matching results.
- [ ] Searching a nonexistent webhook shows the empty state.
- [ ] Clearing search restores the list.
- [ ] Search uses approximately 300 ms debounce.
- [ ] Changing search resets pagination to page 1.
- [ ] Search and page parameters are reflected in the URL.
- [ ] Browser Back/Forward restores search and pagination.
- [ ] Returning from Edit preserves search and page.

### 6. Webhook Editing

- [ ] Edit opens the selected webhook.
- [ ] Name and URL are prefilled.
- [ ] Empty Name shows validation.
- [ ] Invalid URL shows validation.
- [ ] Unsupported URL protocols are rejected.
- [ ] Valid HTTP/HTTPS URLs are accepted.
- [ ] Cancel returns without saving.
- [ ] Save succeeds with valid data.
- [ ] Updated data appears in the list.
- [ ] Reopening Edit shows saved data.
- [ ] Search and page context are preserved after returning.

### 7. Logout

- [ ] Logout redirects to Login.
- [ ] Protected routes are inaccessible after logout.
- [ ] Token revocation request is sent.
- [ ] Previous user data is not exposed from the query cache.
- [ ] Login works again without reloading the application.
- [ ] Webhooks reload after logging in again.

### 8. Security and API

- [ ] Login sends `/auth/login`.
- [ ] Login includes the required captcha token and fingerprint.
- [ ] Session issuance uses `/auth/token/issue`.
- [ ] Protected requests use the active server-side mock session and include `X-Requested-With`.
- [ ] POST/PUT requests include `X-Requested-With` and `X-CSRF-TOKEN`.
- [ ] CSRF token is requested when required.
- [ ] `device_session_token` is absent from Local Storage, Session Storage, and cookies.
- [ ] Passwords and tokens are not logged to Console.

### 9. Production and Responsive UI

- [ ] SPA routes behave correctly after browser refresh.
- [ ] Mobile layout has no unwanted horizontal scrolling or clipped controls.
- [ ] Login, List, and Edit remain usable on narrow screens.
- [ ] Controls are keyboard accessible.
- [ ] Loading, empty, and validation states render correctly.
- [ ] No unexpected 404/500, CORS, or service worker errors.

### Testing Notes

- Demo credentials are already documented earlier in this README.
- MSW uses mock data; changes may reset after a full reload.
- In-memory session tokens do not survive a full page reload.
- 401 rotation, 419 retry, and single-flight behavior are primarily covered by automated tests.
- Error and retry states can be inspected using browser DevTools.
