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
| `INSTAGRAM_SESSION_ID` | Your Instagram `sessionid` cookie value |

To obtain the Instagram session ID:
1. Log in to Instagram in your browser
2. Open DevTools → Application → Cookies → instagram.com
3. Copy the value of the `sessionid` cookie
4. Set `INSTAGRAM_SESSION_ID` in your Replit environment secrets

**Note:** Sources for platforms with missing credentials are skipped gracefully — the pipeline continues and logs a `records_fetched: 0` entry for those sources.

## Cron Schedule

The default schedule is **daily at 06:00 UTC** (`0 6 * * *`).

Override with the `PIPELINE_CRON_SCHEDULE` environment variable:

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
