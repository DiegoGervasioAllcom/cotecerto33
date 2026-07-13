import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Config ISOLADA do vite.config.ts — o plugin do TanStack Start quebra o runner.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "node",
    // Carrega o .env inteiro (inclusive vars sem prefixo VITE_) para process.env dos testes.
    env: loadEnv("", process.cwd(), ""),
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**"],
      // Fora do denominador: tipos/roteador gerados e primitivas de UI (shadcn) —
      // não são alvo de teste unitário e só inflam a métrica.
      exclude: [
        "src/integrations/supabase/database.types.ts",
        "src/routeTree.gen.ts",
        "src/components/ui/**",
      ],
    },
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          globalSetup: ["tests/helpers/global-setup.ts"],
          fileParallelism: false, // banco compartilhado — sem corrida
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
