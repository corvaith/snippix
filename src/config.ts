export const PORT = parseInt(process.env.PORT ?? "3300", 10);
export const HOST = process.env.HOST ?? "0.0.0.0";
export const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
export const API_KEY = process.env.API_KEY ?? "";
