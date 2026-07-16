# Runbook de Deploy — CoteCerto V10 (K6-a)

Este runbook cobre o deploy da stack completa (app + Supabase self-hosted +
nginx) em UM servidor novo/bare. Os arquivos referenciados vivem em
`deploy/` (ver também `deploy/docker-compose.supabase.yml`,
`deploy/docker-compose.app.yml`, `deploy/nginx/`, `deploy/.env.example`).

Produção ainda não está em uso — não há janela de manutenção a respeitar no
primeiro deploy, mas siga os passos na ordem abaixo mesmo assim (é o que
será usado em deploys futuros).

## 0. Fidelidade da réplica (leia antes de tudo)

- **Schema do banco**: replicado 100% via `supabase/migrations/` +
  `supabase/seed.sql` (aplicados no passo 5). Não depende de nada do
  servidor Supabase atual.
- **Segredos/config do servidor atual** (JWT_SECRET, ANON_KEY,
  SERVICE_ROLE_KEY, SMTP, etc.): este runbook assume que você vai **gerar
  segredos NOVOS** (stack nova = identidade nova). Se quiser que usuários
  já cadastrados no Supabase atual continuem autenticando sem precisar
  recriar conta, você precisa **copiar manualmente** os valores de
  `JWT_SECRET` (e, por consequência, `ANON_KEY`/`SERVICE_ROLE_KEY`, que são
  JWTs assinados com ele) do ambiente atual — ninguém tinha essa config à
  mão no momento desta tarefa, então ela não está vendorizada aqui.
  Trade-off: gerar novo = mais simples e mais seguro (rotação de segredo),
  mas invalida sessões/tokens antigos e exige que usuários façam login de
  novo (dados no banco continuam intactos, só o texto do JWT muda).
- **Arquivos de config do Supabase self-hosted**: todos vendorizados do
  template oficial (`supabase/supabase`, `docker/volumes/`) e já com os
  mounts ativos em `deploy/docker-compose.supabase.yml` — `kong-entrypoint.sh`
  (gera o `kong.yml` final via `envsubst`) e os scripts de init do Postgres
  (`jwt.sql`, `webhooks.sql`, `realtime.sql`, `_supabase.sql`, `logs.sql`,
  `pooler.sql`, `roles.sql`). Nada a buscar manualmente antes do primeiro `up`.
- **Supavisor (pooler) removido**: a stack vendorizada aqui NÃO inclui o
  Supavisor (faltava `pooler.exs` no bundle, e nenhum serviço essencial
  depende dele — todos conectam direto em `db:5432`). Acesso administrativo
  externo usa a porta do próprio `db`, publicada só em `127.0.0.1` (SSH
  tunnel). Se quiser voltar a ter um pooler dedicado, adicionar depois.

## 1. Provisionar o servidor

- Servidor Linux (Ubuntu 22.04+ recomendado), mínimo 2 vCPU / 4 GB RAM (o
  Supabase self-hosted sozinho já usa uma boa fatia disso).
- Instalar Docker Engine + Docker Compose plugin:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER   # relogar depois
  docker compose version          # confirmar plugin v2
  ```
- Abrir no firewall apenas as portas **80** e **443** (e 22/SSH). Nenhuma
  outra porta deve ser exposta publicamente (Kong, Postgres, Studio direto
  — tudo passa pelo nginx).
- Clonar o repositório (ou só copiar a pasta `deploy/` + `supabase/` +
  `docs/RUNBOOK_DEPLOY.md`) para o servidor, ex. em `/opt/cotecerto`.

## 2. Gerar segredos

Copie o modelo e preencha (fora do controle de versão):

```bash
cp deploy/.env.example deploy/.env
```

Gere cada segredo com os comandos comentados dentro do próprio
`deploy/.env.example` (openssl). Resumo:

| Variável | Como gerar |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -base64 32` |
| `JWT_SECRET` | `openssl rand -base64 48` (≥32 chars) |
| `ANON_KEY` / `SERVICE_ROLE_KEY` | JWT HS256 assinado com o `JWT_SECRET` acima, claims `role: anon` / `role: service_role`, `iss: supabase-demo` (ou o valor que preferir) — use o script `utils/generate-keys.sh` do template oficial do Supabase, ou qualquer gerador de JWT HS256 compatível |
| `DASHBOARD_PASSWORD` | `openssl rand -base64 24` |
| `SECRET_KEY_BASE` | `openssl rand -base64 48` (≥64 chars) |
| `PG_META_CRYPTO_KEY` | `openssl rand -base64 24` |
| `VAULT_ENC_KEY` | `openssl rand -hex 16` |

**Importante**: `SELF_SUPABASE_SERVICE_ROLE_KEY` (seção "App" do `.env`)
deve ser **idêntico** a `SERVICE_ROLE_KEY` (seção Supabase) — são o mesmo
valor, usado por dois serviços diferentes.

## 3. Login no GHCR (imagem privada)

A imagem `ghcr.io/diegogervasioallcom/cotecerto33` é privada. No servidor:

```bash
# PAT (classic ou fine-grained) com escopo read:packages, gerado em
# https://github.com/settings/tokens
echo "$GHCR_PAT" | docker login ghcr.io -u SEU_USUARIO_GITHUB --password-stdin
```

Guarde o PAT como segredo do servidor (ex. gerenciador de secrets/CI),
nunca em texto no repo.

## 4. Subir o Supabase self-hosted

```bash
cd /opt/cotecerto
docker compose -f deploy/docker-compose.supabase.yml --env-file deploy/.env up -d
docker compose -f deploy/docker-compose.supabase.yml --env-file deploy/.env ps
```

Aguarde todos os serviços ficarem `healthy` (principalmente `db`, do qual
todos os outros dependem).

## 5. Aplicar migrations + seed

Com a Supabase CLI instalada no servidor (ou rodando localmente com túnel
SSH para a porta do `db`, publicada em `127.0.0.1:5432`):

```bash
# Local, via túnel SSH:
ssh -L 5432:127.0.0.1:5432 usuario@servidor

# Em outro terminal, na raiz do repo:
supabase link --project-id cotecerto33 \
  --db-url "postgresql://postgres:$POSTGRES_PASSWORD@127.0.0.1:5432/postgres"
supabase db push          # aplica supabase/migrations/
psql "postgresql://postgres:$POSTGRES_PASSWORD@127.0.0.1:5432/postgres" \
  -f supabase/seed.sql     # aplica o seed
```

(Alternativa sem túnel: copiar `supabase/migrations/*.sql` e `seed.sql`
para o servidor e rodar `psql`/`supabase db push` direto lá, apontando pro
host `db` de dentro de um container na mesma rede Docker.)

## 6. Subir o app + nginx

```bash
docker compose -f deploy/docker-compose.app.yml --env-file deploy/.env up -d
docker compose -f deploy/docker-compose.app.yml --env-file deploy/.env ps
```

Neste ponto o nginx sobe, mas ainda **sem certificado TLS real** (o
`ssl_certificate` em `deploy/nginx/conf.d/app.conf` aponta para
`/etc/letsencrypt/live/PROXY_DOMAIN/...`, que só existe depois do passo 7).
Se o nginx falhar por causa disso, é esperado — siga para o próximo passo.

## 7. DNS + TLS (Let's Encrypt / certbot)

1. Aponte o DNS (registro A/AAAA) de `PROXY_DOMAIN` para o IP do servidor.
2. Edite `deploy/nginx/conf.d/app.conf`, trocando `PROXY_DOMAIN` (nos dois
   `ssl_certificate*`) pelo domínio real.
3. Emissão inicial do certificado (modo standalone, nginx ainda parado ou
   servindo só a porta 80 para o desafio):
   ```bash
   docker compose -f deploy/docker-compose.app.yml --env-file deploy/.env \
     run --rm --entrypoint "" certbot \
     certbot certonly --webroot -w /var/www/certbot \
       -d SEU_DOMINIO --email "$CERTBOT_EMAIL" --agree-tos --non-interactive
   ```
   (O container `certbot` já definido no compose cuida da renovação
   automática depois — roda `certbot renew` a cada 12h.)
4. Recarregue o nginx:
   ```bash
   docker compose -f deploy/docker-compose.app.yml --env-file deploy/.env \
     exec nginx nginx -s reload
   ```

## 8. Smoke test

```bash
curl -I https://SEU_DOMINIO/                        # app (home)
curl -I https://SEU_DOMINIO/auth/v1/health           # Supabase Auth via Kong
curl -I https://SEU_DOMINIO/rest/v1/ -H "apikey: $ANON_KEY"  # PostgREST
```

Espera-se `200`/`301` conforme a rota. Teste também um login real pela UI
e confira os logs:

```bash
docker compose -f deploy/docker-compose.app.yml --env-file deploy/.env logs -f app
docker compose -f deploy/docker-compose.supabase.yml --env-file deploy/.env logs -f kong auth
```

Confirme que o rate limit funciona (S5) — várias requisições rápidas numa
rota `/auth/v1/token` devem começar a retornar `429` acima de ~5 req/s por
IP (zona `auth_zone`).

## 9. Rollback

- **App**: trocar `APP_IMAGE_TAG` em `deploy/.env` para uma tag anterior
  (o CI publica `sha-<curto>` a cada push em `main`, além de `latest`) e:
  ```bash
  docker compose -f deploy/docker-compose.app.yml --env-file deploy/.env \
    pull app
  docker compose -f deploy/docker-compose.app.yml --env-file deploy/.env \
    up -d app
  ```
- **Migrations**: revisar antes de aplicar (não há rollback automático de
  schema); se uma migration causar problema, escrever uma nova migration
  de correção — não editar/apagar migrations já aplicadas em produção.
- **Supabase self-hosted (imagens)**: as tags de cada serviço estão
  pinadas em `deploy/docker-compose.supabase.yml`; para reverter, editar a
  tag do serviço afetado e rodar `docker compose ... up -d <serviço>`.
- **Nginx/TLS**: config fica em `deploy/nginx/`; qualquer alteração pode
  ser revertida via `git` e `docker compose ... exec nginx nginx -s
  reload` (sem downtime, se a nova config for válida — sempre rodar
  `nginx -t` antes de `reload`).

## Ordem resumida (referência rápida)

1. Provisionar servidor (Docker + firewall 80/443).
2. `cp deploy/.env.example deploy/.env` + gerar segredos.
3. `docker login ghcr.io`.
4. Subir `docker-compose.supabase.yml`.
5. Aplicar migrations + seed.
6. Subir `docker-compose.app.yml`.
7. DNS + certbot + reload nginx.
8. Smoke test.
