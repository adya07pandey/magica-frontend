<<<<<<< HEAD
# 🚀 Magica Frontend
=======
# Magica Frontend
>>>>>>> 33bfd71 (adding credits)

Magica is an agent chat interface for running AI media workflows. This repository contains the Next.js frontend: authentication, task history, realtime run updates, attachment upload, and the chat UI that drives backend agent tools such as `gpt_image_2`, `crop_image`, and `merge_videos`.

## Submission Links

- Frontend repository: `https://github.com/adya07pandey/magica-frontend`
- Backend repository: `https://github.com/adya07pandey/magica-backend`
- Deployed app: `https://magica-frontend-phi.vercel.app/`
- API documentation: `<mintlify-docs-url>`

## Tech Stack

- Next.js 16 with App Router
- React 19 and TypeScript
- Clerk for authentication
- TanStack Query for server state
- Zustand for local chat/UI state
- Tailwind CSS 4
- Zod for API response validation
- Vitest, React Testing Library, MSW, and Playwright for tests

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Configure the frontend environment:

```env
BACKEND_URL="https://magica-backend.onrender.com"
NEXT_PUBLIC_API_BASE_URL="/backend"
```

Run the development server:

```bash
pnpm dev
```

Open `http://localhost:3001` if you run the frontend on port 3001, or the URL printed by Next.js. The backend must also be running for authenticated API calls, uploads, task creation, and realtime run events.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `BACKEND_URL` | Yes | Server-side target used by the Next.js rewrite for `/backend/*`. Set this to the deployed backend origin on Vercel. |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Browser API base. Use `/backend` with the rewrite, or a full backend URL if the browser should call the backend directly. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for frontend auth. |

## Available Scripts

```bash
pnpm dev       # Start Next.js in development
pnpm build     # Production build
pnpm start     # Run the production build
pnpm lint      # ESLint
pnpm test      # Unit/component tests
pnpm test:e2e  # Playwright tests
```

## Architecture Overview

The frontend is intentionally thin. It authenticates the user with Clerk, sends chat and upload requests to the backend, and renders task state returned by the API.

- `app/components/magica-chat.tsx` renders the core chat experience, task composer, run status, and generated media outputs.
- `app/components/attachment-uploader.tsx` handles native multi-file uploads and passes ready attachment IDs into prompts.
- `app/lib/api-client.ts` centralizes all backend requests, auth headers, idempotency keys, upload calls, and Server-Sent Events.
- `app/lib/api-schemas.ts` validates backend responses with Zod before the UI consumes them.
- `app/lib/chat-store.ts` stores local UI state that should not be persisted to the backend.
- `next.config.ts` rewrites `/backend/*` to `BACKEND_URL`, which lets the deployed frontend call a separately deployed backend without hardcoding URLs.

## Main User Flow

1. A user signs in with Clerk.
2. The user uploads files or selects existing task attachments.
3. The user sends a prompt from the chat composer.
4. The frontend creates or updates a task through the backend API.
5. The backend starts a durable Trigger.dev run.
6. The frontend subscribes to `/api/v1/runs/{runId}/events` and renders each run update.
7. Generated images, cropped images, or merged videos appear in the task once the tool run completes.

## Design Decisions and Trade-Offs

- API calls are wrapped in one typed client so the UI does not duplicate fetch/auth/error handling.
- Zod validation runs on frontend responses to catch contract drift early during development.
- The frontend uses a `/backend` rewrite by default. This keeps browser-facing code stable while allowing the backend URL to change per environment.
- Uploads use a native file picker and multipart request. This is simpler and more reliable for the demo than a heavier resumable upload UI, while the backend still owns storage validation.
- Realtime updates use Server-Sent Events instead of WebSockets because the app only needs one-way run progress from backend to browser.

## Deployment

Deploy this repository to Vercel as a Next.js app. Set:

```env
BACKEND_URL="https://magica-backend.onrender.com"
NEXT_PUBLIC_API_BASE_URL="/backend"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
```

After deployment, test:

- Sign in/sign up
- Create a new task
- Upload at least one image and one video
- Run `gpt_image_2`
- Run `crop_image`
- Run `merge_videos`
- Refresh an active task and confirm realtime state recovers

## What I Would Improve With More Time

- Add a richer asset library with search, filters, and preview metadata.
- Add drag-and-drop upload progress and resumable large-file uploads.
- Add stronger Playwright coverage for long-running tool workflows.
- Add optimistic UI around task title edits and favorite toggles.
- Add a reviewer/demo mode with preloaded sample assets and prompts.
