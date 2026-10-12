import type { RenderParams } from "../schema.js";
import type { HighlightResult } from "./highlight.js";
import { buildLayout, type Fonts } from "./layout.js";
import { svgFromTree, rasterize } from "./rasterize.js";

export const EXT_BY_FORMAT: Record<string, string> = {
  png: "png",
  svg: "svg",
  webp: "webp",
  jpeg: "jpg",
};

export const CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
  jpeg: "image/jpeg",
};

const FONT_CSS: Record<string, string> = {
  "jetbrains-mono": "JetBrains Mono",
  "fira-code": "Fira Code",
};

export async function renderImage(
  params: RenderParams,
  hl: HighlightResult,
  fonts: Fonts
): Promise<Buffer> {
  const { tree, width, height } = buildLayout(params, hl, fonts) as never as {
    tree: object;
    width: number;
    height: number;
  };
  const fontFamilyCss = FONT_CSS[params.fontFamily] ?? "JetBrains Mono";
  const svg = (await svgFromTree(tree, width, height, fonts, fontFamilyCss)) as unknown as string;
  return rasterize(svg, params, fontFamilyCss, params.scale);
}
