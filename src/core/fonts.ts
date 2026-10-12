import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface Fonts {
  [family: string]: Buffer[];
}

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");

const FAMILY_DIRS: Record<string, string> = {
  "JetBrains Mono": "jetbrains-mono",
  "Fira Code": "fira-code",
};

export async function loadFonts(): Promise<Fonts> {
  const fonts: Fonts = {};
  for (const [family, dir] of Object.entries(FAMILY_DIRS)) {
    const full = path.join(FONTS_DIR, dir);
    try {
      // urutan wajib: Regular, Italic, Bold (dipakai berdasarkan index di rasterize.ts)
      const rank = (f: string) => (/italic/i.test(f) ? 1 : /bold/i.test(f) ? 2 : 0);
      const files = (await readdir(full))
        .filter((f) => /\.(ttf|otf|woff2?)$/i.test(f))
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
      fonts[family] = [];
      for (const f of files) {
        fonts[family].push(await readFile(path.join(full, f)));
      }
    } catch {
      fonts[family] = [];
    }
  }
  return fonts;
}
