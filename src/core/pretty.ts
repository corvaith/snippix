import * as prettierNs from "prettier/standalone";
const prettier = prettierNs as unknown as {
  format: (source: string, options: Record<string, unknown>) => Promise<string>;
};
import * as prettierBabel from "prettier/plugins/babel";
import * as prettierEstree from "prettier/plugins/estree";
import * as prettierTypescript from "prettier/plugins/typescript";
import * as prettierHtml from "prettier/plugins/html";
import * as prettierPostcss from "prettier/plugins/postcss";
import * as prettierYaml from "prettier/plugins/yaml";
import * as prettierGraphql from "prettier/plugins/graphql";
import * as prettierMarkdown from "prettier/plugins/markdown";

const PLUGINS = [
  prettierBabel,
  prettierEstree,
  prettierTypescript,
  prettierHtml,
  prettierPostcss,
  prettierYaml,
  prettierGraphql,
  prettierMarkdown,
];

// prettier language -> shiki language id
const PARSER_BY_LANG: Record<string, string | null> = {
  javascript: "babel",
  js: "babel",
  jsx: "babel",
  javascriptreact: "babel",
  mjs: "babel",
  cjs: "babel",
  typescript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  typescriptreact: "typescript",
  json: "json",
  jsonc: "json",
  json5: "json",
  html: "html",
  vue: "html",
  xml: "html",
  svg: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  yaml: "yaml",
  yml: "yaml",
  graphql: "graphql",
  gql: "graphql",
  markdown: "markdown",
  md: "markdown",
};

export function prettierSupported(lang: string): boolean {
  return Object.prototype.hasOwnProperty.call(PARSER_BY_LANG, lang.toLowerCase());
}

export async function prettyCode(
  code: string,
  lang: string
): Promise<{ code: string; pretty: boolean }> {
  const parser = PARSER_BY_LANG[lang.toLowerCase()];
  if (!parser) return { code, pretty: false };

  // already formatted? skip reformat (prettier is idempotent; detect to save latency)
  try {
    const formatted = await prettier.format(code, {
      parser,
      plugins: PLUGINS as never,
      semi: true,
      singleQuote: false,
      printWidth: 90,
      tabWidth: 2,
    });
    if (formatted === code) return { code, pretty: false };
    return { code: formatted.replace(/\n$/, ""), pretty: true };
  } catch (e) {
    // unparseable code — return original rather than failing the render
    console.error("[pretty] failed:", (e as Error).message?.slice(0, 200));
    return { code, pretty: false };
  }
}
