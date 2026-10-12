import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki";

export type { Highlighter, BundledLanguage };

export const PRELOAD_LANGS = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  "csharp",
  "php",
  "ruby",
  "sql",
  "json",
  "yaml",
  "bash",
  "html",
  "css",
  "markdown",
] as BundledLanguage[];

export const PRELOAD_THEMES = [
  "github-dark",
  "github-light",
  "one-dark-pro",
  "dracula",
  "vitesse-dark",
  "vitesse-light",
] as const;

let highlighter: Highlighter | null = null;

export async function initHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter;
  highlighter = await createHighlighter({
    themes: [...PRELOAD_THEMES],
    langs: [...PRELOAD_LANGS],
  });
  return highlighter;
}

export interface Token {
  content: string;
  color: string;
  fontStyle?: number;
}

export interface Line {
  tokens: Token[];
}

export interface HighlightResult {
  lines: Line[];
  lang: string;
  theme: string;
  themeBg: string;
  themeFg: string;
  loadedLang: boolean;
}

function resolveLang(hl: Highlighter, lang: string): string | null {
  if (lang === "auto" || lang === "") {
    const guesses = ["typescript", "javascript", "python", "go", "rust", "java"];
    for (const g of guesses) {
      if (hl.getLoadedLanguages().includes(g as BundledLanguage)) return null;
    }
    return null;
  }
  if (lang === "plaintext" || lang === "text" || lang === "txt") return "plaintext";
  try {
    return lang as BundledLanguage;
  } catch {
    return null;
  }
}

export async function highlight(
  hl: Highlighter,
  code: string,
  lang: string,
  theme: string
): Promise<HighlightResult> {
  const loadedLangs = hl.getLoadedLanguages();
  const loadedThemes = hl.getLoadedThemes();

  let effective = "plaintext";
  let loadedLang = false;
  if (lang !== "auto" && lang !== "") {
    const candidate =
      lang === "plaintext" || lang === "text" || lang === "txt" ? "plaintext" : lang;
    if (loadedLangs.includes(candidate)) {
      effective = candidate;
      loadedLang = true;
    } else {
      try {
        await hl.loadLanguage(candidate as BundledLanguage);
        effective = candidate;
        loadedLang = true;
      } catch {
        effective = "plaintext";
      }
    }
  }

  let effectiveTheme = theme;
  if (!loadedThemes.includes(theme)) {
    try {
      await hl.loadTheme(theme as never);
    } catch {
      effectiveTheme = "github-dark";
    }
  }
  const themeObj = hl.getTheme(effectiveTheme);
  const tokensResult = hl.codeToTokens(code, {
    lang: effective as never,
    theme: effectiveTheme,
  });

  const lines: Line[] = tokensResult.tokens.map((lineTokens) => ({
    tokens: lineTokens.map((t) => ({
      content: t.content,
      color: t.color ?? themeObj.fg,
      fontStyle: t.fontStyle,
    })),
  }));

  return {
    lines,
    lang: effective,
    theme: effectiveTheme,
    themeBg: themeObj.bg,
    themeFg: themeObj.fg,
    loadedLang,
  };
}
