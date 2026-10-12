import type { FastifyInstance } from "fastify";
import {
  renderParams,
  parseHighlightLines,
  MAX_CODE_CHARS,
  MAX_CODE_LINES,
} from "../schema.js";
import { highlight, type Highlighter } from "../core/highlight.js";
import { loadFonts, type Fonts } from "../core/fonts.js";
import { renderImage, EXT_BY_FORMAT, CONTENT_TYPE } from "../core/render.js";
import { memGet, memSet, diskGet, diskSet, paramHash, removeFile } from "../core/cache.js";
import { BASE_URL } from "../config.js";


let hl: Highlighter;
let fonts: Fonts;

export function setRenderer(h: Highlighter, f: Fonts): void {
  hl = h;
  fonts = f;
}

interface RenderBody extends Record<string, unknown> {}

export async function renderRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/render", { bodyLimit: 256 * 1024 }, handleRender);
  app.get("/v1/render", handleRenderGet);

  app.get("/v1/themes", async () => {
    const themes = hl.getLoadedThemes();
    return { themes: themes.sort() };
  });

  app.get("/v1/languages", async () => {
    const langs = hl.getLoadedLanguages();
    return { languages: langs.filter((l) => l !== "ansi").sort() };
  });

}

function extractParams(input: Record<string, unknown>): unknown {
  return input;
}

async function doRender(params: ReturnType<typeof renderParams.parse>, sourceHash: string) {
  const hash = paramHash({ ...params });
  const cacheKey = `${hash}.${params.format}${params.format === "png" ? `.s${params.scale}` : ""}`;

  const cached = memGet(cacheKey);
  if (cached) {
    return { buf: cached, cache: "memory" as const, cacheKey };
  }
  const diskCached = await diskGet(cacheKey);
  if (diskCached) {
    memSet(cacheKey, diskCached);
    return { buf: diskCached, cache: "disk" as const, cacheKey };
  }

  const hlResult = await highlight(hl, params.code, params.lang, params.theme);
  const buf = await renderImage(params, hlResult, fonts);
  memSet(cacheKey, buf);
  await diskSet(cacheKey, buf);
  return { buf, cache: "miss" as const, cacheKey };
}

async function handleRender(req: any, reply: any) {
  let raw: unknown;
  if (req.method === "GET") {
    const q = req.query as Record<string, string>;
    raw = { ...q };
  } else {
    raw = req.body;
  }

  const parsed = renderParams.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const isSize = first?.message?.includes("exceeds");
    return reply.code(isSize ? 413 : 400).send({
      error: {
        code: isSize ? "payload_too_large" : "validation_error",
        message: first ? `${first.path.join(".")}: ${first.message}` : "invalid params",
      },
    });
  }
  const params = parsed.data;

  if (params.pretty) {
    const { prettyCode } = await import("../core/pretty.js");
    const { code, pretty } = await prettyCode(params.code, params.lang);
    if (pretty) {
      params.code = code;
    }
  }

  const { buf, cache, cacheKey } = await doRender(params, "");


  const etag = `"${cacheKey}"`;
  reply.header("ETag", etag);
  if (req.headers["if-none-match"] === etag) {
    return reply.code(304).send();
  }
  reply.header("Content-Type", CONTENT_TYPE[params.format]);
  reply.header("Cache-Control", "public, max-age=3600");
  reply.header("X-Cache", cache);
  return reply.send(buf);
}

async function handleRenderGet(req: any, reply: any) {
  return handleRender(req, reply);
}
