import satoriModule from "satori";

type SatoriFn = (
  element: object,
  options: {
    width: number;
    height: number;
    fonts: { name: string; data: Buffer; weight: number; style: string }[];
  }
) => Promise<string>;

const mod = satoriModule as unknown as Record<string, unknown>;
export const satori = (typeof mod === "function" ? mod : mod.default) as unknown as SatoriFn;
