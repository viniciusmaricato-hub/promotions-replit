# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Promotions Monitor — an internal competitive intelligence dashboard for tracking competitor betting operator promotions scraped from Instagram and Telegram.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (via `@clerk/react` on frontend, `@clerk/express` on API)
- **Frontend**: React + Vite + TailwindCSS + TanStack Query + Wouter

## Artifacts

### Promotions Monitor (`artifacts/promotions-monitor`)
- Preview path: `/`
- Full React+Vite frontend with Clerk auth, sidebar nav, 4 pages
- Pages: Home (landing), Dashboard (stats + promotions), Promotions (full table + filters + CSV export + detail drawer), Sources (CRUD), Run Logs

### API Server (`artifacts/api-server`)
- Express 5 server on port 8080
- Routes: `GET /api/promotions`, `GET /api/promotions/stats`, `GET /api/promotions/:id`, `GET/POST/PATCH /api/sources`, `GET /api/runs`
- All routes require Clerk auth (`requireAuth` middleware)
- Clerk proxy middleware at `/api/clerk`

### Pipeline (`artifacts/pipeline`)
- Node.js ingestion pipeline with `node-cron` scheduler (default `0 6 * * *` UTC)
- Telegram scraper via `gramjs` (MTProto) — needs `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`
- Instagram scraper via fetch + `INSTAGRAM_SESSION_ID` cookie (auto-derives `ds_user_id` and generates `csrftoken`; can be overridden by `INSTAGRAM_DS_USER_ID` and `INSTAGRAM_CSRF_TOKEN`)
- Disables auto-redirect-following so Instagram login challenges are detected explicitly and logged with workarounds (residential proxy, third-party API)
- LLM extraction uses gpt-5-mini with `response_format: json_object` and 2048 token budget to avoid empty reasoning-only responses
- Run with `pnpm --filter @workspace/pipeline run run-now` (one-shot) or `run start` (in-process cron)
- **Production scheduling**: published as a Replit **Scheduled Deployment** (separate from the dashboard's autoscale deployment). Run command `pnpm --filter @workspace/pipeline run run-now`, default schedule `0 6 * * *` UTC. See `artifacts/pipeline/README.md` for setup steps.
- Inter-source delay configurable via `PIPELINE_INTER_SOURCE_DELAY_MS` (default 3000ms)

## Libraries

- `lib/db` — Drizzle ORM schema + client (`promotions`, `sources`, `runs` tables)
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`) + Orval codegen config
- `lib/api-client-react` — Generated TanStack Query hooks (`useListPromotions`, `useGetPromotionsStats`, `useGetPromotion`, `useListSources`, `useCreateSource`, `useUpdateSource`, `useListRuns`)
- `lib/api-zod` — Generated Zod schemas from OpenAPI spec

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `CLERK_SECRET_KEY` — Clerk secret key (API server)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (frontend)
- `VITE_CLERK_PROXY_URL` — Clerk proxy URL (frontend)
- `VITE_API_BASE_URL` — API server base URL (frontend)

## Data Model

**promotions** — id (uuid), operator, platform, post_date, detected_at, promo_type, offer_details, min_deposit, reward_value, wagering_requirement, expiry_date, target_audience, requires_deposit, source_url, raw_post_text, confidence_score (High/Medium/Low), prompt_version

**sources** — id (serial), name, platform, handle, active, created_at, updated_at

**runs** — id (serial), run_at, source, platform, status (success/error/partial), records_fetched, records_inserted, error_message

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
