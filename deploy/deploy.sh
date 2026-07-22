#!/usr/bin/env bash
# ============================================================================
# Deploy / atualização do app CoteCerto no servidor de produção.
#
# O que faz: baixa a imagem :latest do GHCR, recria o container do app com as
# variáveis de runtime, faz health check e, se falhar, mantém instruções de
# rollback (a imagem anterior fica no docker até o próximo prune).
#
# Pré-requisitos (uma vez): `sudo docker login ghcr.io -u <user>` com um PAT
# `read:packages`. Ver docs/RUNBOOK_DEPLOY.md.
#
# Uso:  ./deploy.sh            (usa :latest)
#       IMAGE_TAG=sha-abc123 ./deploy.sh   (fixa uma tag específica)
# ============================================================================
set -euo pipefail

IMAGE_REPO="ghcr.io/diegogervasioallcom/cotecerto33"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE="${IMAGE_REPO}:${IMAGE_TAG}"
NAME="cotecerto-app"
HOST_BIND="127.0.0.1:3001:3000"           # porta 3000 do host é do Kong -> app na 3001
SUPA_ENV="/home/alldev/supabase/docker/.env"
SUPA_URL="https://supabase-cotecerto.sandboxallcom.com"
QUIVER_ENV="/home/alldev/.quiver-webhook.env"
QUIVER_URL="https://quiver-bot.sandboxallcom.com"
HEALTH_URL="http://127.0.0.1:3001/"

echo "==> imagem alvo: ${IMAGE}"

# service_role lida do .env do Supabase (nunca impressa)
# (|| true: sem isso, set -e/pipefail abortaria antes da mensagem amigável)
SR=$(sudo grep -E '^SERVICE_ROLE_KEY=' "$SUPA_ENV" | cut -d= -f2- || true)
if [ -z "${SR}" ]; then
  echo "ERRO: SERVICE_ROLE_KEY não encontrado em ${SUPA_ENV}" >&2
  exit 1
fi

# Segredo do webhook da Quiver (opcional: se o arquivo ainda não existir, sobe
# sem ele — a integração de cotação real fica indisponível até ser criado,
# mas não bloqueia o deploy do resto do app). Ver docs/RUNBOOK_DEPLOY.md §4.
QUIVER_ENV_ARGS=()
if [ -f "$QUIVER_ENV" ]; then
  # shellcheck disable=SC1090
  source "$QUIVER_ENV"
  QUIVER_ENV_ARGS=(
    -e "SELF_QUIVER_API_URL=${QUIVER_URL}"
    -e "SELF_QUIVER_WEBHOOK_CLIENT_KEY=${QUIVER_KEY:-}"
    -e "SELF_QUIVER_WEBHOOK_CLIENT_SECRET=${QUIVER_SECRET:-}"
  )
else
  echo "AVISO: ${QUIVER_ENV} não encontrado — subindo sem integração Quiver (ver RUNBOOK §4)." >&2
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
  -e SELF_SUPABASE_URL="$SUPA_URL" \
  -e SELF_SUPABASE_SERVICE_ROLE_KEY="$SR" \
  "${QUIVER_ENV_ARGS[@]}" \
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
    sudo docker image prune -f >/dev/null 2>&1 || true
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
