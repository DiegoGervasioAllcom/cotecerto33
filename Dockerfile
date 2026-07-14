# syntax=docker/dockerfile:1
#
# CoteCerto — imagem do app (TanStack Start + Nitro), gerenciado com bun.
#
# Notas importantes:
# - A tag "1.3.14-slim" (patch exato) pode não existir/ser publicada no Docker Hub
#   no momento do build; usamos o minor "1.3-slim" (pinado no minor, atualizado em
#   patches) para evitar builds quebrados. Ajustar para um patch exato quando
#   confirmado disponível, se desejado.
# - `bun run build` roda `vite build`, que por padrão (via
#   @lovable.dev/vite-tanstack-config) usa o preset Nitro "cloudflare-module"
#   (para o preview do Lovable / Cloudflare Workers). Para rodar em container
#   comum, sobrescrevemos via env var NITRO_PRESET=bun, que tem prioridade sobre
#   o defaultPreset do wrapper. NÃO alterar vite.config.ts.
# - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY são embutidas no bundle em
#   build-time (Vite) — por isso entram como ARG/ENV só no estágio de build.
# - SELF_SUPABASE_URL / SELF_SUPABASE_SERVICE_ROLE_KEY são runtime-only (usadas
#   pelas server functions via process.env) — NUNCA entram como build-arg;
#   devem ser passadas com `-e` no `docker run` / compose.

# ---------------------------------------------------------------------------
# Estágio 1: build
# ---------------------------------------------------------------------------
FROM oven/bun:1.3-slim AS build

WORKDIR /app

# Build-time only: embutidas no bundle do Vite. Sem defaults — se não vierem,
# o client.ts entra em modo seguro (ver src/integrations/supabase/client.ts).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY} \
    NITRO_PRESET=bun

# Cache de dependências: copia só os manifests antes do resto do código.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Código-fonte necessário ao build (ver .dockerignore para o que fica de fora).
COPY tsconfig.json vite.config.ts components.json ./
COPY src ./src

RUN bun run build

# ---------------------------------------------------------------------------
# Estágio 2: runtime
# ---------------------------------------------------------------------------
FROM oven/bun:1.3-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Usuário non-root (a imagem base já traz o usuário/grupo "bun").
COPY --from=build --chown=bun:bun /app/.output ./.output

USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok||r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", ".output/server/index.mjs"]
