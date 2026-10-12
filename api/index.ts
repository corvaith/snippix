let cached: any = null;

export default async function handler(req: any, res: any) {
  if (!cached) {
    const { buildApp } = await import("../dist/server.js");
    cached = await buildApp();
    await cached.ready();
  }
  await cached.routing(req, res);
}