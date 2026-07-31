#!/usr/bin/env bash
# ============================================================================
# Deploy / atualização do app CoteCerto no servidor de produção.
#
# O que faz: baixa uma imagem imutável sha-* do GHCR, recria o container com as
# variáveis de runtime via arquivo .env, faz health check e, se falhar, mantém instruções de
# rollback (a imagem anterior fica no Docker; este script não executa prune).
#
# Pré-requisitos (uma vez): `sudo docker login ghcr.io -u <user>` com um PAT
# `read:packages`. Ver docs/RUNBOOK_DEPLOY.md.
#
# Uso: IMAGE_TAG=sha-abc1234 ./deploy.sh
# ============================================================================
set -euo pipefail

IMAGE_REPO="ghcr.io/diegogervasioallcom/cotecerto33"
IMAGE_TAG="${IMAGE_TAG:-}"
if [[ ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]+$ ]]; then
  echo "ERRO: IMAGE_TAG obrigatória no padrão sha-<commit>; latest não é permitido" >&2
  exit 1
fi
IMAGE="${IMAGE_REPO}:${IMAGE_TAG}"
NAME="cotecerto-app"
HOST_BIND="127.0.0.1:3001:3000"           # porta 3000 do host é do Kong -> app na 3001
APP_ENV="${APP_ENV:-/home/alldev/.cotecerto-app.env}"
HEALTH_URL="http://127.0.0.1:3001/"

echo "==> imagem alvo: ${IMAGE}"

# Um único arquivo protegido contém todo o runtime. Além de evitar segredos no
# repositório, isto evita passá-los como valores de `-e` na linha de comando.
if [ ! -f "$APP_ENV" ]; then
  echo "ERRO: arquivo de runtime não encontrado: ${APP_ENV}" >&2
  exit 1
fi

mode=$(sudo stat -c '%a' "$APP_ENV")
if [ "$mode" != "600" ]; then
  echo "ERRO: ${APP_ENV} deve ter permissão 600 (atual: ${mode})" >&2
  exit 1
fi

required=(
  SELF_SUPABASE_URL
  SELF_SUPABASE_ANON_KEY
  SELF_SUPABASE_SERVICE_ROLE_KEY
  SELF_RESEND_API_KEY
  SELF_APP_URL
  SELF_QUIVER_API_URL
  SELF_QUIVER_WEBHOOK_CLIENT_KEY
  SELF_QUIVER_WEBHOOK_CLIENT_SECRET
)
for key in "${required[@]}"; do
  if ! sudo grep -qE "^${key}=.+" "$APP_ENV"; then
    echo "ERRO: variável obrigatória ausente ou vazia em ${APP_ENV}: ${key}" >&2
    exit 1
  fi
done

if ! sudo grep -qFx 'SELF_APP_URL=https://cote-certo.sandboxallcom.com' "$APP_ENV"; then
  echo "ERRO: SELF_APP_URL deve apontar para o domínio público de produção" >&2
  exit 1
fi
if ! sudo grep -qFx 'SELF_SUPABASE_URL=https://supabase-cotecerto.sandboxallcom.com' "$APP_ENV"; then
  echo "ERRO: SELF_SUPABASE_URL deve apontar para o Supabase público de produção" >&2
  exit 1
fi
if ! sudo grep -qFx 'SELF_QUIVER_API_URL=https://quiver-bot.sandboxallcom.com' "$APP_ENV"; then
  echo "ERRO: SELF_QUIVER_API_URL deve usar o endpoint HTTPS de produção da Quiver" >&2
  exit 1
fi

# guarda a imagem atual (para rollback manual, se preciso)
OLD_IMAGE=$(sudo docker inspect -f '{{.Config.Image}}' "$NAME" 2>/dev/null || true)
[ -n "${OLD_IMAGE}" ] && echo "==> imagem atual (rollback): ${OLD_IMAGE}"

echo "==> docker pull"
sudo docker pull "$IMAGE"

echo "==> recriando container ${NAME}"
sudo docker stop "$NAME" >/dev/null 2>&1 || true
sudo docker rm "$NAME"   >/dev/null 2>&1 || true
sudo docker run -d --name "$NAME" --restart unless-stopped \
  -p "$HOST_BIND" \
  --env-file "$APP_ENV" \
  "$IMAGE" >/dev/null

echo "==> health check (${HEALTH_URL})"
code=000
for i in 1 2 3 4 5 6; do
  sleep 2
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo 000)
  case "$code" in
    2??|3??) break ;;
  esac
done

case "$code" in
  2??|3??)
    echo "==> OK: app respondeu HTTP ${code}"
    echo "==> deploy concluído."
    ;;
  *)
    echo "==> FALHA: app respondeu HTTP ${code}" >&2
    echo "    logs:     sudo docker logs --tail 50 ${NAME}" >&2
    if [ -n "${OLD_IMAGE}" ]; then
      echo "    rollback: recrie o container com a imagem anterior: ${OLD_IMAGE}" >&2
      echo "              (mesmo docker run acima, trocando \$IMAGE por ${OLD_IMAGE})" >&2
    fi
    exit 1
    ;;
esac
