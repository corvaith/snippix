import { z } from "zod";

export const MAX_CODE_CHARS = 10_000;
export const MAX_CODE_LINES = 300;

const hexRe = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const rgbaRe = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;

const color = z
  .string()
  .max(40)
  .refine(
    (v) => v === "transparent" || hexRe.test(v) || rgbaRe.test(v),
    "must be hex, rgba() or 'transparent'"
  );

export const renderParams = z.object({
  code: z
    .string()
    .min(1, "code is required")
    .max(MAX_CODE_CHARS, `code exceeds ${MAX_CODE_CHARS} characters`)
    .refine(
      (v) => v.split("\n").length <= MAX_CODE_LINES,
      `code exceeds ${MAX_CODE_LINES} lines`
    ),
  lang: z.string().max(40).default("auto"),
  theme: z.string().max(60).default("github-dark"),
  format: z.enum(["png", "svg", "webp", "jpeg"]).default("png"),
  scale: z.coerce.number().int().min(1).max(3).default(2),
  background: color.default("#abb8c3"),
  padding: z.coerce.number().int().min(0).max(200).default(48),
  fontFamily: z.enum(["jetbrains-mono", "fira-code"]).default("jetbrains-mono"),
  fontSize: z.coerce.number().int().min(8).max(32).default(14),
  lineNumbers: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true")
    .default(false),
  firstLine: z.coerce.number().int().min(1).max(100000).default(1),
  highlightLines: z
    .string()
    .max(200)
    .regex(/^(\d+(-\d+)?)(\s*,\s*\d+(-\d+)?)*$/, "expected e.g. 1,3-5")
    .optional(),
  windowControls: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true")
    .default(true),
  windowTitle: z.string().max(120).default(""),
  pretty: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true")
    .default(false),
  shadow: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true")
    .default(true),
});

export type RenderParams = z.infer<typeof renderParams>;

export function parseHighlightLines(spec: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!spec) return out;
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i);
  }
  return out;
}
