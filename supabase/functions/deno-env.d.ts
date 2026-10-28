// Tipovi za Deno API koji koriste Edge Functions — SAMO za VS Code.
// Ugrađeni TypeScript u VS Code-u ne zna za globalni objekat `Deno`, pa bez
// ovoga prijavljuje "Cannot find name 'Deno'". Supabase funkcije izvršava u
// Deno-u, koji ove tipove ima ugrađene; ovaj fajl se ne objavljuje i ne utiče
// na rad funkcija. Potpisi su isti kao u Deno-u (docs.deno.com/api/deno).
//
// Ako jednom instaliraš Deno ekstenziju za VS Code i uključiš je za
// supabase/functions (deno.enablePaths), ovaj fajl i tsconfig.json ovde
// više nisu potrebni — obriši ih.

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }

  export const env: Env;

  export interface ServeHandlerInfo {
    remoteAddr: { hostname: string; port: number; transport: string };
  }

  export type ServeHandler = (request: Request, info: ServeHandlerInfo) => Response | Promise<Response>;

  export interface HttpServer {
    finished: Promise<void>;
    shutdown(): Promise<void>;
  }

  export function serve(handler: ServeHandler): HttpServer;
}
