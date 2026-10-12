# Code Image API

Render code snippets as beautiful images (Carbon-style) — no headless browser, tens of milliseconds.

## Stack

- **Fastify** — HTTP + validation
- **Shiki** — syntax highlighting (TextMate grammars)
- **Satori** — JSX-like layout tree → SVG
- **@resvg/resvg-js** — SVG → PNG (sharp for WebP/JPEG)
- LRU memory cache + disk cache with 1h TTL and quota

## Run

```bash
npm install
npm run build
PORT=3300 node dist/server.js
# dev: npm run dev
```

## API

### `POST /v1/render`

Body JSON, response is binary image (`Content-Type` per format).

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `code` | string | required | max 10,000 chars / 300 lines |
| `lang` | string | `auto` | Shiki language name, falls back to plaintext |
| `theme` | string | `github-dark` | Shiki theme id (preloaded ones listed at `/v1/themes`; other bundled Shiki themes are loaded on demand) |
| `format` | `png`\|`svg`\|`webp`\|`jpeg` | `png` | |
| `scale` | 1–3 | 2 | pixel ratio |
| `background` | color | `#abb8c3` | hex / rgba / `transparent` |
| `padding` | int | 48 | px |
| `fontFamily` | `jetbrains-mono`\|`fira-code` | `jetbrains-mono` | bundled |
| `fontSize` | int | 14 | 8–32 |
| `lineNumbers` | bool | false | |
| `firstLine` | int | 1 | |
| `highlightLines` | string | – | e.g. `1,3-5` |
| `windowControls` | bool | true | traffic lights |
| `windowTitle` | string | – |  |
| `pretty` | bool | false | auto-format the code (Prettier) before render — JS/TS/JSON/HTML/CSS/YAML/GraphQL/Markdown; unsupported langs & unparseable code pass through untouched |
| `shadow` | bool | true | |

```bash
curl -X POST localhost:3300/v1/render \
  -H 'Content-Type: application/json' \
  -d '{"code":"console.log(1)","lang":"javascript"}' -o out.png
```

### `GET /v1/render?code=...`

Same params via query string (URL-encoded) — handy for embeds.

### Other endpoints

- `GET /v1/themes` — loaded theme ids
- `GET /v1/languages` — loaded language ids
- `GET /health`

### Errors

```json
{ "error": { "code": "validation_error", "message": "..." } }
```

`400` validation · `413` payload too large · `429` rate limited · `404` unknown/expired file · `500`

## Storage & cleanup

- Every render is fully stateless from the client's perspective: the image binary comes straight back in the response body.
- A render cache lives in `CACHE_DIR` (default `/tmp/code-image-cache`, `<hash>.bin`, keyed by params) — set `CACHE_DISK=0` (or deploy on Vercel, auto-detected via `VERCEL=1`) to disable disk entirely; memory LRU still applies.
- Cache entries expire after `FILE_TTL_SECONDS` (default 3600) via a cleanup job every `CLEANUP_INTERVAL_SECONDS` (300). Quota `MAX_CACHE_MB` (500) evicts oldest first. Atomic writes (tmp + rename).

## Security

- Body limit 256 KB, code caps (10k chars / 300 lines), font whitelist, color regex validation, no eval, per-IP rate limit (120/min), optional `API_KEY` env (send as `X-API-Key`).

## Benchmarks (2 vCPU VPS)

- Cache hit: p50 ≈ 0.6 ms, p95 ≈ 0.9 ms
- Cache miss (30-line JS, cold glyphs): p50 ≈ 165 ms, p95 ≈ 240 ms
- Repeated-language misses are faster once glyph caches are warm

## License

ISC
