# Runbook de Deploy — CoteCerto (produção)

Procedimento **real** de deploy, validado em produção em 16/07/2026. Descreve como
o app é publicado **integrado** à infraestrutura já existente no servidor
(Supabase self-hosted + nginx + certbot), sem subir stack paralela.

> Este runbook substitui a antiga stack "greenfield" (K6-a), que partia da premissa
> errada de servidor zerado. Aqui documentamos o que de fato roda.

---

## 1. Topologia

Um único servidor (AWS EC2, Ubuntu 24.04), atrás de **Cloudflare**, rodando:

| Componente               | Onde                                            | Observação                                                                        |
| ------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| **Supabase self-hosted** | `/home/alldev/supabase/docker` (docker compose) | Postgres `15.8.1.085`, Kong, GoTrue, PostgREST, Realtime, Storage, Pooler etc.    |
| **App CoteCerto**        | container `cotecerto-app` (imagem GHCR)         | servidor Nitro/Bun na porta **3000** do container → publicado em `127.0.0.1:3001` |
| **nginx**                | host (`/etc/nginx/sites-available/default`)     | reverse proxy + TLS                                                               |
| **certbot**              | host                                            | 2 certificados: `cote-certo...` (app) e `supabase-cotecerto...` (API)             |

Domínios:

- **`cote-certo.sandboxallcom.com`** → nginx → `127.0.0.1:3001` (app)
- **`supabase-cotecerto.sandboxallcom.com`** → nginx → `localhost:3000` (Kong/Supabase)

> ⚠️ A porta **3000 do host** já é do **Kong** (Supabase). Por isso o app é publicado
> em **3001**. O Postgres/pooler (5432) **não** é acessível de fora (Cloudflare só
> proxia HTTP/S) — operações de banco rodam **dentro do servidor**.

### Como o app fala com o Supabase

- **Cliente (browser):** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` são **embutidas
  em build-time** na imagem (via build-args do CI — `vars.VITE_SUPABASE_URL` /
  `secrets.VITE_SUPABASE_ANON_KEY`). A `anon key` **não é segredo** (vai pro browser).
- **Servidor (server functions, ex.: `admin-users.functions.ts`):** leem em **runtime**
  `SELF_SUPABASE_URL` e `SELF_SUPABASE_SERVICE_ROLE_KEY` (a `service_role`, que **nunca**
  vai pro browser nem pro build) via `process.env` — passadas no `docker run`.

---

## 2. Pré-requisitos

- Acesso SSH ao servidor (usuário `alldev`, com `sudo`).
- **PAT do GitHub** (classic) com escopo **`read:packages`** para puxar a imagem privada.
- A imagem imutável publicada no GHCR: `ghcr.io/diegogervasioallcom/cotecerto33:sha-<commit>`
  (o workflow `.github/workflows/docker.yml` publica a cada push na `main`).

---

## 3. Fase 1 — Banco (primeira carga / rebuild limpo)

> Necessário **só na primeira vez** ou quando quiser reconstruir o schema do zero.
> Para mudanças incrementais depois, ver §6.

O schema é definido pelas 82 migrations atuais em `supabase/migrations/` +
`supabase/seed.sql`. Confirme a contagem antes de cada rebuild; esse número cresce.
O procedimento gera um **artefato único** (`bootstrap_prod.sql`) validado localmente e o
aplica no Postgres de produção.

### 3.1 Gerar e validar o artefato (na máquina de dev)

```bash
# 1) aplica todas as migrations + seed num banco limpo local (valida a ordem)
supabase start && supabase db reset

# 2) monta o bootstrap: reset do schema public + migrations em ordem + seed
BOOT=~/cotecerto_bootstrap_prod.sql
cat > "$BOOT" <<'HDR'
\set ON_ERROR_STOP on
BEGIN;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT CREATE, USAGE ON SCHEMA public TO postgres, service_role;
COMMIT;
HDR
for f in $(ls supabase/migrations/*.sql | sort); do
  printf '\n-- >>> %s <<<\n' "$(basename "$f")" >> "$BOOT"; cat "$f" >> "$BOOT"
done
printf '\n-- >>> seed <<<\n' >> "$BOOT"; cat supabase/seed.sql >> "$BOOT"

# 3) ENSAIO: aplica o bootstrap no banco local — tem que rodar sem ERROR
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f "$BOOT"
```

> **Gotchas evitados aqui:** não incluir a seção de histórico gerada por `pg_dump`
> (o cliente PG17 emite `SET transaction_timeout` e `\restrict`, que o **Postgres 15
> não entende**). O histórico é criado à parte, na etapa 3.4.

Suba o `~/cotecerto_bootstrap_prod.sql` para o servidor via **SFTP** (Termius).

### 3.2 Backup do banco atual (segurança)

No checkpoint V11 de 31/07/2026, o responsável dispensou este backup porque a
produção controlada ainda não possui usuários nem dados a preservar. Essa é uma
decisão pontual: em qualquer deploy posterior com dados reais, o backup volta a
ser obrigatório.

```bash
sudo docker exec supabase-db pg_dump -U postgres -d postgres > ~/backup_prod_$(date +%F_%H%M%S).sql
```

### 3.3 Conceder acesso ao `pg_cron` (uma vez)

As migrations de SLA usam `pg_cron`. No Supabase self-hosted o `postgres` **não** é
superusuário e não tem acesso à tabela `cron.job` por padrão — sem isso a migration
`030` falha com `permission denied for table job`. Conceda como `supabase_admin`
(o superusuário):

```bash
sudo docker exec -i supabase-db psql -U supabase_admin -d postgres <<'SQL'
grant usage on schema cron to postgres;
grant all on all tables in schema cron to postgres;
grant all on all sequences in schema cron to postgres;
grant execute on all functions in schema cron to postgres;
alter default privileges in schema cron grant all on tables to postgres;
SQL
```

### 3.4 Aplicar o bootstrap + histórico + reiniciar serviços

```bash
# aplica o schema (o DROP SCHEMA public no topo torna a operação idempotente)
sudo docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < ~/cotecerto_bootstrap_prod.sql 2>&1 | tail -20   # esperar SEM "ERROR:"

# cria a tabela de histórico do Supabase e registra todas as versões
# (gerar o bloco com: for f in supabase/migrations/*.sql; do echo "insert ..."; done)
# ver o gerador em §3.5

# recarrega o cache de schema do PostgREST etc.
sudo docker restart supabase-rest supabase-auth realtime-dev.supabase-realtime supabase-storage supabase-meta
```

Validar as contagens sem fixá-las na documentação:

```bash
sudo docker exec -i supabase-db psql -U postgres -d postgres -tAc \
"select
  (select count(*) from pg_tables  where schemaname='public') as tabelas,
  (select count(*) from pg_policies where schemaname='public') as policies,
  (select count(*) from supabase_migrations.schema_migrations) as hist,
  (select count(*) from auth.users where email='desenvolvimento@suppercerto.com.br') as admin;"
```

### 3.5 Gerador do bloco de histórico (PG15-safe)

```bash
{
  echo "create schema if not exists supabase_migrations;"
  echo "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"
  for f in $(ls supabase/migrations/*.sql | sort); do
    b=$(basename "$f" .sql); v=${b%%_*}; n=${b#*_}
    echo "insert into supabase_migrations.schema_migrations(version,name) values ('$v','$n') on conflict (version) do nothing;"
  done
} | sudo docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Credenciais do admin semeado: `desenvolvimento@suppercerto.com.br` / `Supper@123!`.

---

## 4. Fase 2 — App (container)

Crie uma vez o arquivo de runtime do app no servidor. Ele não é versionado e
deve conter também os segredos de e-mail e da Quiver. Edite-o diretamente, sem
colar valores no terminal, em logs ou em comandos do histórico:
>
> ```bash
> sudo install -m 600 /dev/null /home/alldev/.cotecerto-app.env
> sudo nano /home/alldev/.cotecerto-app.env
> ```

Modelo (substitua os marcadores somente no servidor):

```dotenv
SELF_SUPABASE_URL=https://supabase-cotecerto.sandboxallcom.com
SELF_SUPABASE_ANON_KEY=<ANON_KEY do Supabase>
SELF_SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY do Supabase>
SELF_RESEND_API_KEY=<chave Resend de produção>
SELF_APP_URL=https://cote-certo.sandboxallcom.com
SELF_QUIVER_API_URL=https://quiver-bot.sandboxallcom.com
SELF_QUIVER_WEBHOOK_CLIENT_KEY=<segredo compartilhado com a Quiver>
SELF_QUIVER_WEBHOOK_CLIENT_SECRET=<segredo compartilhado com a Quiver>
```

O arquivo deve permanecer `600`. `SELF_SUPABASE_SERVICE_ROLE_KEY` e
`SELF_RESEND_API_KEY` nunca entram no build, no Git ou no browser.

```bash
# 1) login no GHCR (cole o PAT no prompt Password: — fica escondido)
sudo docker login ghcr.io -u DiegoGervasioAllcom

# 2) baixar a imagem
sudo docker pull ghcr.io/diegogervasioallcom/cotecerto33:sha-abc1234

# 3) subir o container (porta 3001 só no localhost; runtime lido do .env protegido)
sudo docker run -d --name cotecerto-app --restart unless-stopped \
  -p 127.0.0.1:3001:3000 \
  --env-file /home/alldev/.cotecerto-app.env \
  ghcr.io/diegogervasioallcom/cotecerto33:sha-abc1234

# 4) testar localmente (antes de tocar no nginx) — esperar HTTP 200
sleep 3; curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/
sudo docker logs --tail 15 cotecerto-app
```

> Conferência opcional da anon key (a embutida na imagem tem que bater com a do
> Supabase, senão o login não conecta):
>
> ```bash
> BAKED=$(sudo docker exec cotecerto-app sh -c "grep -rhoE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' .output/public | sort -u | head -1")
> ENVKEY=$(sudo grep -E '^ANON_KEY=' /home/alldev/supabase/docker/.env | cut -d= -f2-)
> [ "$BAKED" = "$ENVKEY" ] && echo MATCH || echo DIFERENTE
> ```

---

## 5. Fase 3 — nginx

O bloco `server` do `cote-certo` deixa de servir estático (`root /var/www/cotecerto`)
e passa a fazer proxy pro container. O bloco do Supabase **não muda**.

```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak.$(date +%s)
sudo nano /etc/nginx/sites-available/default   # editar o bloco cote-certo (443)
```

O `location /` do `cote-certo` deve ficar:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
}
```

Aplicar:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://cote-certo.sandboxallcom.com/
```

Abrir **https://cote-certo.sandboxallcom.com** e logar.

---

## 6. Atualizar banco e app

### 6.1 Checkpoint antes do deploy

Só prossiga quando o CI da revisão estiver verde e a imagem imutável
`sha-<commit>` existir no GHCR. O script recusa tag ausente, `latest` ou qualquer
tag fora desse padrão. Registre sem remover a imagem anterior:

```bash
sudo docker inspect -f '{{.Config.Image}} {{.Image}}' cotecerto-app
```

Use a tag SHA no deploy; `latest` não é referência de rollback.

### 6.2 Configurar GoTrue para o fluxo de criação de senha

No `/home/alldev/supabase/docker/.env`, configure:

```dotenv
SITE_URL=https://cote-certo.sandboxallcom.com
ADDITIONAL_REDIRECT_URLS=https://cote-certo.sandboxallcom.com/auth/criar-senha
MAILER_OTP_EXP=172800
```

Confirme que o serviço `auth` no `docker-compose.yml` contém o mapeamento abaixo;
a distribuição padrão já mapeia os dois primeiros, mas **não mapeia o terceiro**
(confirmado em produção em 01/08/2026 — sem essa linha, `MAILER_OTP_EXP` no `.env`
não tem efeito nenhum):

```yaml
GOTRUE_SITE_URL: ${SITE_URL}
GOTRUE_URI_ALLOW_LIST: ${ADDITIONAL_REDIRECT_URLS}
GOTRUE_MAILER_OTP_EXP: ${MAILER_OTP_EXP}
```

Valide e recrie apenas o Auth, depois aguarde o health check:

```bash
cd /home/alldev/supabase/docker
sudo docker compose config --quiet
sudo docker compose up -d --force-recreate auth
sudo docker inspect -f '{{.State.Health.Status}}' supabase-auth
```

### 6.3 Ordem obrigatória: migrations antes do app

1. Valide todas as migrations em banco local limpo (`supabase db reset`).
2. Aplique em produção somente as migrations novas, com parada imediata em erro,
   e registre as versões no histórico conforme §3.5.
3. Recarregue o schema do PostgREST e valide banco/Auth.
4. Só então publique a imagem do app pela tag `sha-<commit>`.

Neste checkpoint, não faça rebuild do schema nem seed após validar os e-mails:
isso apagaria a evidência do smoke test.

### 6.4 Publicar o app

Após um novo push na `main` (o CI republica a imagem `:latest`), use o script
versionado **`deploy/deploy.sh`** — ele faz pull, recria o container, health check
(com retry) e dá instruções de rollback se falhar.

**Instalar (uma vez):** copie `deploy/deploy.sh` para o servidor (ex.: via SFTP para
`/home/alldev/deploy.sh`) e `chmod +x`. Requer o `docker login ghcr.io` já feito (§4).

```bash
# fixar a tag do commit aprovada no CI
IMAGE_TAG=sha-abc1234 ./deploy.sh
```

Equivalente manual (o que o script faz por baixo):

```bash
sudo docker pull ghcr.io/diegogervasioallcom/cotecerto33:sha-abc1234
sudo docker stop cotecerto-app && sudo docker rm cotecerto-app
sudo docker run -d --name cotecerto-app --restart unless-stopped \
  -p 127.0.0.1:3001:3000 \
  --env-file /home/alldev/.cotecerto-app.env \
  ghcr.io/diegogervasioallcom/cotecerto33:sha-abc1234
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/
```

> **Auto-deploy via CI (opção futura):** dá pra disparar `deploy.sh` automaticamente a
> cada push na `main` com um step que faz SSH no servidor. Exige guardar uma chave SSH
> nos secrets do GitHub e abrir acesso pros runners — mais superfície de ataque. Por ora
> o deploy é manual (um comando), que é mais simples e seguro.

**Mudanças de banco (nova migration):** como o histórico agora existe (§3.4), dá pra
aplicar incrementalmente com `supabase db push` apontando pro Postgres local **de
dentro do servidor**, ou reaplicar só o(s) arquivo(s) novo(s) via `psql` e inserir a
linha em `supabase_migrations.schema_migrations`. Rebuild completo (§3) só se necessário.

### 6.5 Health e smoke test V11

Depois do health local, valide o domínio público e execute com uma conta temporária:

```bash
curl -fsS -o /dev/null https://cote-certo.sandboxallcom.com/
curl -fsS -o /dev/null https://supabase-cotecerto.sandboxallcom.com/auth/v1/health
sudo docker inspect -f '{{.State.Health.Status}}' cotecerto-app
```

- aprovar um acesso e confirmar uma única mensagem de boas-vindas;
- conferir inbox e spam, remetente, link público e expiração de 48 horas;
- abrir `/auth/criar-senha`, definir a senha e autenticar;
- confirmar que reutilizar o link não permite nova definição;
- validar pendência, recusa e retry da outbox sem envio duplicado;
- verificar logs apenas por status/ID, nunca imprimir payload, token ou chave.

### 6.6 Marcar os 2 diretores iniciais (regra 2 das Regras Decididas)

`profiles.diretor` não tem seed automático em produção — só `supabase/seed.sql`
(dev/local) cria Ana e Melo. Em produção, os diretores reais **já existem como
contas próprias** (cadastradas pelo fluxo normal de convite); falta só marcar
`diretor = true`. Sem isso, nenhuma tela de Governança funciona (Salvar
política, Diretores, Histórico) — `fn_eh_diretor` retorna falso pra todo mundo.

Rode uma única vez, com os e-mails reais dos 2 diretores:

```sql
update public.profiles
   set diretor = true
 where email in ('email-do-diretor-1@...', 'email-do-diretor-2@...');
```

Confirme depois: `select id, nome, email, diretor from public.profiles where diretor;`
deve retornar exatamente 2 linhas.

---

## 7. Rollback

**App:**

```bash
# use a tag SHA hexadecimal registrada no checkpoint; nunca use latest como rollback
sudo docker stop cotecerto-app && sudo docker rm cotecerto-app
IMAGE_TAG=sha-deadbee ./deploy.sh
```

**nginx (voltar ao estático anterior):**

```bash
sudo cp $(ls -t /etc/nginx/sites-available/default.bak.* | head -1) /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx
```

**Banco:** restaurar o backup de §3.2:

```bash
sudo docker exec -i supabase-db psql -U postgres -d postgres < ~/backup_prod_XXXX.sql
```

---

## 8. Gotchas conhecidos (aprendidos no deploy real)

| Sintoma                                                                    | Causa                                                          | Correção                                                          |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `permission denied for table job` na migration 030                         | `postgres` sem acesso a `cron.*` no self-hosted                | GRANTs como `supabase_admin` (§3.3)                               |
| `invalid command \restrict` / `unrecognized parameter transaction_timeout` | `pg_dump` (cliente PG17) gera SQL incompatível com Postgres 15 | não vendorizar a seção do `pg_dump`; gerar histórico à mão (§3.5) |
| `unauthorized` no `docker pull`                                            | login no GHCR não feito / PAT sem `read:packages`              | `docker login ghcr.io` com PAT correto (§4)                       |
| porta 3000 ocupada                                                         | Kong (Supabase) já usa a 3000 do host                          | publicar o app em **3001**                                        |
| login não conecta                                                          | anon key embutida ≠ anon key do Supabase                       | conferir fingerprint (§4)                                         |
| `MAILER_OTP_EXP` no `.env` não muda a validade do link                     | a distribuição self-hosted não mapeia `GOTRUE_MAILER_OTP_EXP` no `docker-compose.yml` — só `GOTRUE_SITE_URL` e `GOTRUE_URI_ALLOW_LIST` vêm mapeados por padrão | adicionar `GOTRUE_MAILER_OTP_EXP: ${MAILER_OTP_EXP}` no serviço `auth` do `docker-compose.yml` (mesmo lugar do §6.2), antes de `--force-recreate auth` — confirmado em produção em 01/08/2026 |
