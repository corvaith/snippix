import type { Line } from "./highlight.js";
import type { RenderParams } from "../schema.js";
import { parseHighlightLines } from "../schema.js";

export interface Fonts {
  [family: string]: Buffer[];
}

const FONT_MAP: Record<string, string> = {
  "jetbrains-mono": "JetBrains Mono",
  "fira-code": "Fira Code",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Satori requires explicit width/height. We estimate monospace char width as 0.6em.
function estimateWidth(params: RenderParams, lines: Line[]): { w: number; h: number } {
  const longest = lines.reduce(
    (max, l) => Math.max(max, l.tokens.reduce((s, t) => s + t.content.length, 0)),
    0
  );
  const gutter = params.lineNumbers
    ? Math.max(3, String(params.firstLine + lines.length - 1).length) + 3
    : 0;
  // JetBrains Mono advance = 0.6em, but ligatures/kerning vary; use 0.63 and a 2ch safety margin
  const chars = Math.max(longest + gutter + 4, 40);
  const contentW = Math.ceil(chars * params.fontSize * 0.68);
  const contentH = lines.length * Math.round(params.fontSize * 1.6);
  return { w: contentW, h: contentH };
}


// Satori drops whitespace-only spans in flex rows; fold spaces into adjacent tokens.
function mergeWhitespace(tokens: { content: string; color: string; fontStyle?: number }[]) {
  const out: { content: string; color: string; fontStyle?: number }[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if (prev && prev.color === t.color && prev.fontStyle === t.fontStyle) {
      prev.content += t.content;
    } else if (t.content.trim() === "" && t.content.length > 0) {
      if (prev) prev.content += t.content;
      else out.push({ ...t, content: t.content });
    } else {
      out.push({ ...t });
    }
  }
  return out;
}

export function buildLayout(
  params: RenderParams,
  hl: { lines: Line[]; themeBg: string; themeFg: string },
  _fonts: Fonts
): { svg: string; width: number; height: number } {
  const themeFg = hl.themeFg;
  const themeBg = hl.themeBg;
  const { w: contentW, h: contentH } = estimateWidth(params, hl.lines);
  const pad = params.padding;
  const titleBarH = params.windowControls || params.windowTitle ? 40 : 0;
  const cardW = contentW + pad * 2;
  const cardH = titleBarH + contentH + pad;
  const width = cardW + (params.shadow ? 60 : 0) + pad;
  const height = cardH + (params.shadow ? 60 : 0) + pad;
  const radius = 12;
  const fontFamily = FONT_MAP[params.fontFamily] ?? "JetBrains Mono";
  const highlightSet = parseHighlightLines(params.highlightLines);
  const lineHeight = Math.round(params.fontSize * 1.6);

  const titleBar = params.windowControls || params.windowTitle
    ? {
        type: "div",
        style: {
          display: "flex",
          alignItems: "center",
          height: `${titleBarH}px`,
          paddingLeft: "16px",
          paddingRight: "16px",
          gap: "8px",
        },
        children: [
          params.windowControls
            ? {
                type: "div",
                style: { display: "flex", gap: "8px" },
                children: [
                  { type: "div", style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ff5f57" } },
                  { type: "div", style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#febc2e" } },
                  { type: "div", style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#28c840" } },
                ],
              }
            : null,
          params.windowTitle
            ? {
                type: "div",
                style: {
                  fontSize: "13px",
                  color: themeFg,
                  opacity: 0.7,
                  marginLeft: "8px",
                  fontFamily,
                },
                children: params.windowTitle,
              }
            : null,
        ].filter(Boolean),
      }
    : null;

  const codeLines = hl.lines.map((line, idx) => {
    const lineNo = params.firstLine + idx;
    const isHighlighted = highlightSet.has(lineNo);
    const children: object[] = [];
    if (params.lineNumbers) {
      const gutterW = Math.max(3, String(params.firstLine + hl.lines.length - 1).length) + 2;
      children.push({
        type: "div",
        style: {
          width: `${gutterW}ch`,
          minWidth: `${gutterW * params.fontSize * 0.6}px`,
          textAlign: "right",
          paddingRight: "16px",
          color: themeFg,
          opacity: 0.35,
          fontFamily,
        },
        children: String(lineNo),
      });
    }
    children.push({
      type: "div",
      style: { display: "flex", fontFamily },
      children: line.tokens.length
        ? mergeWhitespace(line.tokens).map((t) => ({
            type: "span",
            style: {
              color: t.color,
              fontFamily,
              whiteSpace: "pre",
              fontStyle: (t.fontStyle ?? 0) & 1 ? "italic" : "normal",
              fontWeight: (t.fontStyle ?? 0) & 2 ? 700 : 400,
            },
            children: t.content.replace(/\n$/, ""),
          }))
        : [{ type: "span", style: { fontFamily }, children: " " }],
    });

    return {
      type: "div",
      style: {
        display: "flex",
        height: `${lineHeight}px`,
        alignItems: "center",
        backgroundColor: isHighlighted ? "rgba(255,235,59,0.18)" : "transparent",
        borderRadius: isHighlighted ? "4px" : "0px",
      },
      children,
    };
  });

  const card = {
    type: "div",
    style: {
      display: "flex",
      flexDirection: "column",
      width: `${cardW}px`,
      height: `${cardH}px`,
      backgroundColor: themeBg,
      borderRadius: `${radius}px`,
      overflow: "hidden",
    },
    children: [
      ...(titleBar ? [titleBar] : []),
      {
        type: "div",
        style: {
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "center",
          padding: `${Math.round(pad / 2)}px ${Math.round(pad / 2)}px`,
        },
        children: codeLines,
      },
    ],
  };

  const tree = {
    type: "div",
    style: {
      width: `${width}px`,
      height: `${height}px`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: params.background === "transparent" ? "transparent" : params.background,
    },
    children: [
      ...(params.shadow
        ? [0, 1, 2, 3, 4, 5, 6].map((i) => ({
            type: "div",
            style: {
              position: "absolute",
              left: `calc(50% - ${(cardW / 2 + 6 + i * 2).toFixed(0)}px)`,
              top: `calc(50% - ${(cardH / 2 + 6 + i * 2).toFixed(0)}px)`,
              width: `${cardW + 12 + i * 4}px`,
              height: `${cardH + 12 + i * 4}px`,
              borderRadius: `${radius + 3 + i}px`,
              backgroundColor: `rgba(0,0,0,${(0.03 - i * 0.003).toFixed(3)})`,
            },
            children: [],
          }))
        : []),
      card,
    ],
  };

  return { tree, width, height } as never;
}

export { escapeXml };
