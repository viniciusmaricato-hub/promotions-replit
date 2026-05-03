# Promotions Ingestion Pipeline

Automated scraper that pulls the latest posts from Telegram channels and Instagram profiles configured in the `sources` database table, runs LLM extraction to parse promotion details, and writes structured records to the `promotions` table.

## Quick Start

### Run the pipeline immediately (one-shot)

```bash
pnpm --filter @workspace/pipeline run run-now
```

### Start the scheduler (runs on cron schedule)

```bash
pnpm --filter @workspace/pipeline run start
```

## Required Environment Variables

### OpenAI (auto-configured by Replit AI Integrations)

| Variable | Description |
|---|---|
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Auto-set by Replit AI Integrations |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Auto-set by Replit AI Integrations |

### Telegram (MTProto — required to scrape Telegram sources)

| Variable | Description |
|---|---|
| `TELEGRAM_API_ID` | Your Telegram App API ID from https://my.telegram.org |
| `TELEGRAM_API_HASH` | Your Telegram App API Hash from https://my.telegram.org |
| `TELEGRAM_SESSION` | **Required in practice.** StringSession string from a prior authenticated run |

The scraper uses gramjs (MTProto) to read public channel history. Although public channels can be browsed anonymously in the Telegram app, the MTProto API requires an authenticated session to fetch message history. Without `TELEGRAM_SESSION`, gramjs will attempt to create an anonymous session on first connect — this may succeed for some public channels but will fail for others.

**Recommended bootstrap flow:**

1. Go to https://my.telegram.org and sign in
2. Click "API development tools" → create an application
3. Copy the `api_id` and `api_hash`
4. Set `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` in Replit secrets
5. Run a one-time authentication script (using the gramjs `StringSession` approach) to obtain a session string
6. Copy the printed session string and set it as `TELEGRAM_SESSION` in Replit secrets

Once `TELEGRAM_SESSION` is set, the scraper reuses it on every run without re-authenticating.

### Instagram (required to scrape Instagram sources)

| Variable | Description |
|---|---|
| `INSTAGRAM_SESSION_ID` | **Required.** Your Instagram `sessionid` cookie value |
| `INSTAGRAM_DS_USER_ID` | Optional. The numeric user ID from your `ds_user_id` cookie. Auto-derived from `sessionid` when omitted. |
| `INSTAGRAM_CSRF_TOKEN` | Optional. The `csrftoken` cookie value. A random token is generated when omitted. |

To obtain the Instagram cookies:
1. Log in to Instagram in your browser
2. Open DevTools → Application → Cookies → instagram.com
3. Copy the values of the `sessionid`, `ds_user_id`, and `csrftoken` cookies
4. Set them as secrets in Replit (only `INSTAGRAM_SESSION_ID` is strictly required)

**IMPORTANT — Instagram IP trust:** Instagram aggressively rejects sessions that appear to be reused from a different IP address than the one where the login took place. When the session is not trusted, the API redirects to a login challenge page and our scraper logs an "Auth challenge" warning. Common symptoms:

- `Auth challenge for <user>: Instagram redirected to /accounts/login/...` — the cookie is being rejected for this server's IP. Workarounds:
  - Capture a fresh session from the same region/IP as the server when possible
  - Use a residential proxy
  - Switch to a third-party Instagram scraping API (Apify, RapidAPI, etc.)
- `No user ID returned for <user>` with `status=ok` — Instagram returned an empty profile payload. This is another flavor of the same trust issue, sometimes specific to high-traffic public accounts. The same workarounds apply.
- `HTTP 404` on profile lookup — the handle does not exist on Instagram. Check the `sources` table and correct the `handle` field via the Sources page in the dashboard.

**Note:** Sources for platforms with missing credentials are skipped gracefully — the pipeline continues and logs a `records_fetched: 0` entry for those sources.

## Daily Recurrent Run

The pipeline is designed to run once per day. It is published as a **Replit Scheduled Deployment** that lives alongside the main app's autoscale deployment.

### Production — Replit Scheduled Deployment (recommended)

Each scheduled run is a one-shot invocation that exits cleanly when finished — perfect for Replit's scheduled-deployment runtime.

1. Open the **Publishing** tool in the workspace
2. Click **Create deployment** → choose **Scheduled**
3. Configure:
   - **Build command** *(optional, leave blank — `tsx` runs the TypeScript directly at runtime)*
   - **Run command**: `pnpm --filter @workspace/pipeline run run-now`
   - **Schedule**: `0 6 * * *` *(daily at 06:00 UTC — or use the natural-language input, e.g. "every day at 6am UTC")*
   - **Job timeout**: 30 minutes is a safe upper bound for a typical run
4. Add the deployment secrets the pipeline needs (these are **separate** from the main app's secrets):
   - `DATABASE_URL` — same Postgres database the dashboard reads from
   - `INSTAGRAM_SESSION_ID`
   - `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION` *(only if you have Telegram operators configured)*
   - `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
5. Click **Deploy**

The first run kicks off on the next scheduled tick. Subsequent runs append to the `runs` table, visible on the dashboard's **System Logs** page.

### Development — Replit workflow (in-process scheduler)

A workspace workflow named **"Pipeline Scheduler"** is configured to run
`pnpm --filter @workspace/pipeline run start`, which boots the in-process
`node-cron` scheduler defined in `src/index.ts`. It is started
automatically alongside the other dev workflows so that automated runs
also happen in the dev environment (default `0 6 * * *` UTC). Override
the schedule for the dev workflow by setting `PIPELINE_CRON_SCHEDULE` in
the workspace secrets.

### Local & one-shot runs

```bash
# Trigger a single immediate run (mirrors what the scheduled deployment does)
pnpm --filter @workspace/pipeline run run-now

# Start the in-process node-cron scheduler (useful for long local dev sessions;
# fires on the same default schedule as production)
pnpm --filter @workspace/pipeline run start
```

### Schedule overrides (in-process cron only)

Only relevant when running the in-process scheduler via `pnpm run start`. Replit's scheduled deployment uses the cron expression configured in the Publishing UI and ignores this env var.

```bash
PIPELINE_CRON_SCHEDULE="0 */6 * * *"  # Every 6 hours
PIPELINE_CRON_SCHEDULE="0 8 * * 1-5"  # Weekdays at 08:00 UTC
```

## How It Works

1. **Source loading** — Reads all active sources from the `sources` table (`active = true`)
2. **Scraping** — Fetches the latest 20 posts from each source (Telegram or Instagram)
3. **Deduplication** — Checks `source_url` against existing `promotions` records; duplicates are skipped silently
4. **LLM extraction** — Each new post is sent to GPT with prompt version `v1` to extract structured fields
5. **Database write** — Extracted promotions (including `prompt_version`) are inserted into `promotions`
6. **Run logging** — A row is written to `runs` for each source with: timestamp, records fetched, records inserted, and any errors

## LLM Prompt

The extraction prompt is stored in `src/llm.ts` as `EXTRACTION_PROMPT` with version `PROMPT_VERSION = "v1"`.

The model is instructed to return `null` for any field it cannot confidently identify — hallucination is explicitly forbidden. Posts that are too short or ambiguous produce a `Low` confidence record with all fields null.

## Adding Sources

Insert rows into the `sources` table:

```sql
INSERT INTO sources (name, platform, handle, active)
VALUES ('BetOperator', 'Telegram', '@betoperator_channel', true);

INSERT INTO sources (name, platform, handle, active)
VALUES ('BetOperator', 'Instagram', 'betoperator', true);
```

Set `active = false` to pause scraping for a source without deleting it.
