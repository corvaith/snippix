import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";
import { readdir, unlink, stat, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

const MEMORY_CACHE_MAX_MB = parseInt(process.env.MEMORY_CACHE_MB ?? "100", 10);
// disk cache off on Vercel (ephemeral /tmp, no cross-invocation sharing) unless forced on
const DISK_ENABLED =
  process.env.CACHE_DISK === "1" ||
  (process.env.CACHE_DISK !== "0" && process.env.VERCEL !== "1");
export const FILE_TTL_SECONDS = parseInt(process.env.FILE_TTL_SECONDS ?? "3600", 10);
export const CLEANUP_INTERVAL_SECONDS = parseInt(
  process.env.CLEANUP_INTERVAL_SECONDS ?? "300",
  10
);
const MAX_CACHE_MB = parseInt(process.env.MAX_CACHE_MB ?? "500", 10);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const CACHE_DIR = process.env.CACHE_DIR ?? "/tmp/code-image-cache";

const memCache = new LRUCache<string, Buffer>({
  maxSize: MEMORY_CACHE_MAX_MB * 1024 * 1024,
  sizeCalculation: (v) => v.byteLength,
});

export function paramHash(params: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 24);
}

export function memGet(key: string): Buffer | undefined {
  return memCache.get(key);
}

export function memSet(key: string, buf: Buffer): void {
  memCache.set(key, buf);
}

export async function diskGet(key: string): Promise<Buffer | null> {
  if (!DISK_ENABLED) return null;
  const file = path.join(CACHE_DIR, `${key}.bin`);
  try {
    return await readFileIfExists(file);
  } catch {
    return null;
  }
}

async function readFileIfExists(file: string): Promise<Buffer | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function diskSet(key: string, buf: Buffer): Promise<void> {
  if (!DISK_ENABLED || buf.byteLength > MAX_FILE_BYTES) return;
  await mkdir(CACHE_DIR, { recursive: true });
  const final = path.join(CACHE_DIR, `${key}.bin`);
  const tmp = `${final}.${process.pid}.${Date.now()}.tmp`;
  const { writeFile } = await import("node:fs/promises");
  await writeFile(tmp, buf);
  await rename(tmp, final);
  await enforceQuota();
}

async function enforceQuota(): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(CACHE_DIR);
  } catch {
    return;
  }
  const files: { name: string; size: number; mtime: number }[] = [];
  let total = 0;
  for (const name of entries) {
    if (!name.endsWith(".bin")) continue;
    try {
      const st = await stat(path.join(CACHE_DIR, name));
      files.push({ name, size: st.size, mtime: st.mtimeMs });
      total += st.size;
    } catch {
      /* raced with cleanup */
    }
  }
  if (total <= MAX_CACHE_MB * 1024 * 1024) return;
  files.sort((a, b) => a.mtime - b.mtime);
  for (const f of files) {
    if (total <= MAX_CACHE_MB * 1024 * 1024) break;
    await unlink(path.join(CACHE_DIR, f.name)).catch(() => {});
    total -= f.size;
  }
}

export async function cleanupOnce(): Promise<number> {
  if (!DISK_ENABLED) return 0;
  let entries: string[];
  try {
    entries = await readdir(CACHE_DIR);
  } catch {
    return 0;
  }
  const cutoff = Date.now() - FILE_TTL_SECONDS * 1000;
  let removed = 0;
  for (const name of entries) {
    const file = path.join(CACHE_DIR, name);
    try {
      const st = await stat(file);
      if (st.mtimeMs < cutoff) {
        await unlink(file);
        removed++;
      }
    } catch {
      /* file vanished */
    }
  }
  return removed;
}

export function startCleanupTimer(): NodeJS.Timeout {
  const t = setInterval(async () => {
    const n = await cleanupOnce();
    if (n > 0) console.log(`[cleanup] removed ${n} expired files`);
  }, CLEANUP_INTERVAL_SECONDS * 1000);
  t.unref();
  return t;
}

export async function startupSweep(): Promise<void> {
  if (!DISK_ENABLED) return;
  await mkdir(CACHE_DIR, { recursive: true });
  const n = await cleanupOnce();
  if (n > 0) console.log(`[startup] swept ${n} stale files`);
}

export async function removeFile(key: string): Promise<void> {
  await unlink(path.join(CACHE_DIR, `${key}.bin`)).catch(() => {});
}

export async function cacheDirSizeMB(): Promise<number> {
  try {
    const entries = await readdir(CACHE_DIR);
    let total = 0;
    for (const name of entries) {
      const st = await stat(path.join(CACHE_DIR, name)).catch(() => null);
      if (st) total += st.size;
    }
    return total / (1024 * 1024);
  } catch {
    return 0;
  }
}

export { rm };
