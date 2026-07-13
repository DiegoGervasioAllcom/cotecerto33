import { loadEnv } from "vite";

/** Health check: falha rápido e claro se o Supabase local não estiver de pé. */
export default async function setup() {
  const env = loadEnv("", process.cwd(), "");
  const url = env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
  try {
    const r = await fetch(`${url}/auth/v1/health`, {
      signal: AbortSignal.timeout(2000),
      headers: env.VITE_SUPABASE_ANON_KEY ? { apikey: env.VITE_SUPABASE_ANON_KEY } : undefined,
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
  } catch (e) {
    throw new Error(
      `\n\n⛔ Supabase local não está rodando em ${url}.\n` +
      `   Execute \`bun run db:start\` antes de \`bun run test:db\`.\n   (${e})\n`,
    );
  }
}
