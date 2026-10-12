import { satori } from "./satori-shim.js";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import type { Fonts } from "./layout.js";
import type { RenderParams } from "../schema.js";
import type { HighlightResult } from "./highlight.js";

type SatoriNode = {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown };
};

function toSatori(node: unknown): SatoriNode | string | (SatoriNode | string)[] | null {
  if (node == null) return null;
  if (Array.isArray(node)) {
    return node.map(toSatori).filter((n): n is SatoriNode | string => n != null);
  }
  if (typeof node === "object" && node !== null && "type" in node) {
    const n = node as { type: string; style?: Record<string, unknown>; children?: unknown };
    return {
      type: n.type,
      props: {
        style: n.style,
        children: toSatori(n.children) ?? undefined,
      },
    };
  }
  return String(node);
}

export async function svgFromTree(
  tree: object,
  width: number,
  height: number,
  fonts: Fonts,
  fontFamily: string
): Promise<string> {
  const family = fontFamily in fonts ? fontFamily : Object.keys(fonts)[0];
  const regular = fonts[family][0];
  const bold = fonts[family][1];
  const fontList = [
    { name: family, data: regular, weight: 400, style: "normal" },
    ...(bold && family === "JetBrains Mono" && fonts[family].length > 2
      ? [
          { name: family, data: fonts[family][1], weight: 400, style: "italic" },
          { name: family, data: fonts[family][2], weight: 700, style: "normal" },
        ]
      : bold
        ? [{ name: family, data: bold, weight: 700, style: "normal" }]
        : []),
  ];
  return satori(toSatori(tree) as never, {
    width,
    height,
    fonts: fontList as never,
  }) as unknown as string;
}

export async function rasterize(
  svg: string,
  params: RenderParams,
  fontFamilyCss: string,
  scale: number
): Promise<Buffer> {
  if (params.format === "svg") return Buffer.from(svg, "utf8");

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(widthOf(svg) * scale) },
    font: { fontFiles: [], loadSystemFonts: false },
  });
  const png = resvg.render().asPng();

  if (params.format === "png") return Buffer.from(png);

  if (params.format === "webp") {
    return sharp(png).webp({ quality: 90 }).toBuffer();
  }
  return sharp(png).jpeg({ quality: 90 }).toBuffer();
}

function widthOf(svg: string): number {
  const m = svg.match(/width="(\d+(?:\.\d+)?)"/);
  return m ? parseFloat(m[1]) : 800;
}

export { };
