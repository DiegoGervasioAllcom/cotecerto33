# Runbook de Deploy — CoteCerto (produção)

Procedimento operacional atualizado em 12/08/2026. Descreve como o app é
publicado **integrado** à infraestrutura já existente no servidor
(Supabase self-hosted + nginx + certbot), sem subir stack paralela.

> Este runbook substitui a antiga stack "greenfield" (K6-a), que partia da
> premissa de servidor zerado. Afirmações datadas de produção ficam na seção
> **Evidência**, separadas do procedimento que deve ser reexecutado.

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

O schema é definido pelas migrations atuais em `supabase/migrations/` +
`supabase/seed.sql`. Havia 175 migrations em 22/08/2026 (última aplicada em
produção até então: `20260824000000`); confirme a contagem antes de cada
rebuild (`find supabase/migrations -maxdepth 1 -name '*.sql' | wc -l`), porque
esse número cresce.
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
  (select count(*) from auth.users) as usuarios_auth;"
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

As personas e credenciais do ambiente descartável estão no `supabase/seed.sql`.
Não copie esses valores para documentação, tickets, logs ou produção.

---

## 4. Fase 2 — App (container)

Crie uma vez o arquivo de runtime do app no servidor. Ele não é versionado e
deve conter também os segredos de e-mail e da Quiver. Edite-o diretamente, sem
colar valores no terminal, em logs ou em comandos do histórico:

> ```bash
> sudo install -m 600 /dev/null /home/alldev/.cotecerto-app.env
> sudo nano /home/alldev/.cotecerto-app.env
> ```

Modelo (substitua os marcadores somente no servidor):

```dotenv
SELF_SUPABASE_URL=https://supabase-cotecerto.sandboxallcom.com
SELF_SUPABASE_ANON_KEY=<ANON_KEY do Supabase>
SELF_SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY do Supabase>
SELF_RESEND_API_KEY=<chave da API Resend de produção>
SELF_APP_URL=https://cote-certo.sandboxallcom.com
SELF_QUIVER_API_URL=https://quiver-bot.sandboxallcom.com
SELF_QUIVER_WEBHOOK_CLIENT_KEY=<segredo compartilhado com a Quiver>
SELF_QUIVER_WEBHOOK_CLIENT_SECRET=<segredo compartilhado com a Quiver>
SELF_PLACA_API_URL=https://ws.sisconsulta.com/ApiSisconsulta/Integracao/DecodificadorAR
SELF_PLACA_API_CLIENTE=<cliente da conta sisconsulta>
SELF_PLACA_API_CHAVE=<chave da conta sisconsulta>
SELF_CPF_API_URL=https://ws.sisconsulta.com/ApiSisconsulta/Bot/LocalizacaoSimples
# Fallback de placa (opcional — sem isso o app funciona só com a sisconsulta acima)
SELF_PLACA_API_BACKUP_URL=https://wdapi2.com.br/consulta
SELF_PLACA_API_BACKUP_TOKEN=<token da conta wdapi2>
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

### 6.2 Configurar GoTrue para criação e recuperação de senha

No `/home/alldev/supabase/docker/.env`, configure:

```dotenv
SITE_URL=https://cote-certo.sandboxallcom.com
ADDITIONAL_REDIRECT_URLS=https://cote-certo.sandboxallcom.com/auth/criar-senha,https://cote-certo.sandboxallcom.com/auth/redefinir-senha
MAILER_OTP_EXP=172800
SMTP_ADMIN_EMAIL=<remetente autenticado no provider>
SMTP_HOST=<host SMTP do provider>
SMTP_PORT=587
SMTP_USER=<usuário SMTP>
SMTP_PASS=<segredo SMTP>
SMTP_SENDER_NAME=CoteCerto
```

Confirme que o serviço `auth` no `docker-compose.yml` contém o mapeamento abaixo;
a distribuição padrão já mapeia os dois primeiros, mas **não mapeia o terceiro**
(confirmado em produção em 01/08/2026 — sem essa linha, `MAILER_OTP_EXP` no `.env`
não tem efeito nenhum):

```yaml
GOTRUE_SITE_URL: ${SITE_URL}
GOTRUE_URI_ALLOW_LIST: ${ADDITIONAL_REDIRECT_URLS}
GOTRUE_MAILER_OTP_EXP: ${MAILER_OTP_EXP}
GOTRUE_SMTP_ADMIN_EMAIL: ${SMTP_ADMIN_EMAIL}
GOTRUE_SMTP_HOST: ${SMTP_HOST}
GOTRUE_SMTP_PORT: ${SMTP_PORT}
GOTRUE_SMTP_USER: ${SMTP_USER}
GOTRUE_SMTP_PASS: ${SMTP_PASS}
GOTRUE_SMTP_SENDER_NAME: ${SMTP_SENDER_NAME}
```

Valide e recrie apenas o Auth, depois aguarde o health check:

```bash
cd /home/alldev/supabase/docker
sudo docker compose config --quiet
sudo docker compose up -d --force-recreate auth
sudo docker inspect -f '{{.State.Health.Status}}' supabase-auth
```

Confirme a configuração efetiva sem imprimir valores secretos:

```bash
sudo docker exec supabase-auth sh -c 'for k in GOTRUE_SITE_URL GOTRUE_URI_ALLOW_LIST GOTRUE_MAILER_OTP_EXP GOTRUE_SMTP_HOST GOTRUE_SMTP_PORT GOTRUE_SMTP_USER; do test -n "$(printenv "$k")" || exit 1; done'
```

A allowlist precisa conter **as duas** rotas públicas: `/auth/criar-senha`
(ativação/boas-vindas) e `/auth/redefinir-senha` ("Esqueci minha senha"). Não
use wildcard de domínio. Credenciais SMTP ficam somente no `.env` protegido do
Supabase; não entram no compose, na imagem, no GitHub Actions ou nos logs.

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
- solicitar em `/auth/esqueci-senha`, receber o e-mail do GoTrue e concluir em
  `/auth/redefinir-senha`;
- confirmar resposta neutra para endereço inexistente e que um link de recovery
  usado, expirado ou substituído não redefine a senha;
- validar pendência, recusa e retry da outbox sem envio duplicado;
- verificar logs apenas por status/ID, nunca imprimir payload, token ou chave.

### 6.6 Evidência de produção

Registre para cada publicação: data/hora, tag `sha-*`, migrations aplicadas,
status dos containers, códigos HTTP e resultado de cada caso do smoke test.
Não registre endereço de destinatário, senha, token, URL de recovery completa,
API key ou credencial SMTP.

**Snapshot de 12/08/2026:** envio transacional via API Resend e recuperação via
SMTP do Resend configurado no GoTrue, incluindo os callbacks públicos da allowlist, foram comprovados
operacionalmente. Essa evidência é histórica: qualquer mudança de DNS, provider,
SMTP, GoTrue, allowlist, domínio ou imagem exige uma nova rodada.

**22/08/2026 — migrations `20260821010000`/`20260823000000`/`20260824000000`
aplicadas:** produção estava parada em `20260822000000` (pulou a
`20260821010000` — ver gotcha na §8 sobre a ordem). Rodado o script combinado
descrito na §8 (DDL das duas primeiras + função completa da última), sem
`ERROR`, histórico confirmado com as 3 versões no topo. Publicação da imagem
do app (tag `sha-3c8b23a`, PR #214) e smoke test da §6.5 ainda pendentes de
confirmação nesta rodada.

**19/09/2026 — migrations `20260917000000`/`20260917010000`/`20260917020000`/
`20260917030000` aplicadas (PR #233, Frente 9 · menu Vendedor V12):** produção
já estava com a Etapa 7 (PRs #229-232) publicada em rodada anterior não
registrada nesta seção. Aplicadas as 4 migrations novas via `psql` direto
(uma por vez, cada uma isolada, sem script combinado — não havia gotcha de
ordem desta vez), sem `ERROR` em nenhuma; histórico confirmado com as 4
versões no topo. `supabase-rest` reiniciado para recarregar o schema (tabelas
novas `lead_agendamentos`/`lembretes`); esse serviço não tem `HEALTHCHECK`
configurado no compose, então `docker inspect .State.Health.Status` não se
aplica a ele (comportamento esperado, não é falha). Imagem do app publicada
via `deploy.sh` (tag `sha-9f4c7f8`) — health check do próprio script OK
(HTTP 200); `curl` externo em `https://cote-certo.sandboxallcom.com/` também
retornou HTTP 200. `cotecerto-app` (que tem `HEALTHCHECK`) estava em
`starting` no instante checado, transitório esperado logo após recriar o
container. Smoke test manual da §6.5 (login como vendedor real, conferir os
11 itens do menu, testar uma transmissão real pela Etapa 7 — primeira vez
em produção) ainda pendente de confirmação nesta rodada.

**28/09/2026 — migrations `20260925031355`/`20260925033524`/`20260925190208`/
`20260928054400` aplicadas (PR #238, Frente 3 V12 · tutorial do vendedor):**
produção já tinha `20260924020332` e `20260924162114` (PR #237) aplicadas em
rodada anterior não registrada aqui. Antes, conferido que `ramo` só tinha
`Automóvel` (o CHECK novo aceita Automóvel/Moto/Vida/Residencial/Celular).
As 4 migrations foram aplicadas num **script único dentro de uma transação**
(conteúdo dos 4 arquivos, em ordem, + o `insert` de cada versão em
`supabase_migrations.schema_migrations`, entre `begin`/`commit`) — ensaiado
antes no banco local com `rollback` no lugar do `commit`. Saída sem `ERROR`,
`COMMIT` no fim e histórico com as 6 versões desde `20260917030000`;
`UPDATE 9` é o backfill de `calculo_visto_em` das cotações já calculadas
(evita o aviso "COTAÇÃO FINALIZADA" em massa). `supabase-rest` reiniciado.
App publicado via `deploy.sh` com a tag `sha-5294247` (imagem anterior,
para rollback: `sha-9015183`); health check do script OK (HTTP 200).
Smoke test pelo navegador em 28/09/2026, logado como vendedor real, só
navegando (nada criado nem transmitido), sem erro no console:

- Início: fila "O que fazer agora" com 7 itens em ordem de urgência (negócio
  em risco + pendência da seguradora com a mensagem real do robô), números
  `COT-2026-…` com o ano de criação.
- Tutorial: abertura "TUTORIAL · O DIA A DIA DO VENDEDOR · Vou te mostrar o
  sistema inteiro"; cap. 1 (passos 1–3) e cap. 4 (passos 1–4, preview do
  Cálculo com selo "Exemplo do tutorial", "(em breve)" em Mensagens/Prêmio,
  Engrenagem só com "Análise do envio") conforme o protótipo.
- Agenda: resumo 7 atrasados / 0 hoje / 7 no total, chips de filtro com
  contagem (risco 5, seguradora 2).
- Pipeline: colunas com rolagem interna e rodapé "mais N"; após reload,
  cabeçalho "27 de 27 leads em andamento · 3 em negociação".
- Em negociação: "Aguardando cotação — 0" × "Cotação finalizada — 5".
- Cálculo: "Abrir cálculo" (`step=5`) de uma cotação com transmissão em
  falha abre a lista comparativa (13 seguradoras, faixa de contexto real).
- Transmissão: Em finalização → "Tentar novamente" (só navega, `step=6`)
  abre o card da falha; **reload mantém o card** (não volta ao Cálculo).
- Emissão: as 2 propostas em falha em "Aguardando a seguradora", "Concluídas"
  vazia, Documentos/Consultar desabilitados.

Observações (não bloqueiam, a investigar):

- Na primeira abertura do Pipeline, logo após fechar o tutorial, o cabeçalho
  mostrou "0 de 0 leads" e as colunas só a contagem carregada (5); a view
  `pipeline_resumo_etapas` estava correta (22/3/2/1) e um reload mostrou os
  números certos — não reproduzido de novo.
- O Pipeline mostra a coluna "Perdido" com o filtro Status "todos"
  (divergência documentada do PR #237), mas o cap. 7 do tutorial diz, como no
  protótipo, que lead perdido não aparece no quadro.
- Em finalização mostra o prêmio da tentativa (ex. R$ 429, PRP-00023) e a
  Emissão o prêmio da proposta (R$ 1.287,74) para a mesma proposta —
  provavelmente parcela × total; conferir e rotular.
- Em negociação: cotações criadas em 18–19/08 aparecem com "Expira em: Hoje".

**28/09/2026 (2ª rodada) — migration `20260928090000_premio_base_soma_parcelas`
aplicada (PR #240, ajustes do smoke test):** antes, consulta só de leitura em
`propostas` × `cotacao_transmissoes` mostrou uma proposta afetada pelo bug do
prêmio só parcelado: **PRP-00001** com `premio = 623.92` (1 parcela de
"em 12x de R$ 623,92"), sem `comissao_valor` e sem lançamentos em
`comissao_lancamentos`; PRP-00023 e PRP-00046 corretas (à vista). Migration
aplicada num script único em transação (conteúdo do arquivo + `insert` no
histórico), ensaiado antes no banco local com `rollback`; saída sem `ERROR`,
`COMMIT`, histórico com `20260928054400` e `20260928090000`. `supabase-rest`
reiniciado. App publicado via `deploy.sh` com a tag `sha-e8eb361` (rollback:
`sha-5294247`); health check do script OK (HTTP 200).

Correções de dados (em transação, com trava):

- **PRP-00001:** `premio = 7487.04`, `parcelas = 12`, `valor_parcela = 623.92`
  (12 × 623,92), só se `premio` ainda fosse 623.92; conferido depois que
  nenhum lançamento de comissão foi criado. Resultado `UPDATE 1`.
- **Tentativas antigas em `cotacao_transmissoes`:** as 13 sem `parcelas_num` e
  com texto de parcelamento legível (não à vista) receberam `premio` = soma
  das parcelas, `parcelas_num` e `valor_parcela` via
  `fn_premio_total_de_parcelas`, depois de uma prévia só de leitura conferida
  linha a linha. Resultado `UPDATE 13`. São tentativas que não geraram
  proposta nova — não afetam comissão.

Gotcha: no bash do servidor, `!` dentro de aspas duplas dispara a expansão do
histórico (`-bash: !~: event not found`) e o comando não roda. Passar SQL por
heredoc com delimitador entre aspas (`<<'SQL'`) ou evitar `!~`.

Smoke test pelo navegador (vendedor real, só navegando, sem erro no console):
Pipeline abre em "Ativos" (sem a coluna Perdido) e o cabeçalho vem certo na
primeira abertura ("27 de 27 leads em andamento"); Em negociação mostra
"Vencida há 35/36 dias" nas cotações de agosto; Emissão mostra PRP-00001
"R$ 7.487,04 · 12x R$ 623,92"; Em finalização mostra o total com o
parcelamento das últimas tentativas ("R$ 1.287,75 · 3x de R$ 429,25",
"R$ 4.025,76 · 12x de R$ 335,48").

**29/09/2026 — Frente 4 V12 (PRs #242 e #243 no app; #42 e #43 no robô):**
três migrations aplicadas pelo usuário com o roteiro único do deploy (cada
uma num bloco em transação, com o `insert` no histórico), ensaiado antes no
banco local com `rollback`, sem erro:
`20260929043546_v12_quiver_raw_sem_bruto` (a RPC `registrar_premios_quiver`
grava o raw sem `htmlSnippet`/`rawText`), `20260929043548_v12_quiver_raw_limpa_bruto`
(limpeza em lotes do que já estava gravado — `pg_dump -t public.cotacoes`
antes, porque não tem volta) e `20260929045643_v12_transmissao_protocolo`
(`registrar_resultado_transmissao_quiver` com `p_protocolo`). App publicado
via `deploy.sh` com a tag `sha-594aaa5` (rollback: `sha-e8eb361`). Robô
atualizado na máquina dele (§6.8). Deploy executado e informado pelo usuário;
o smoke test abaixo confirma no navegador as funções entregues.

Smoke test pelo navegador (vendedor real; lead manual novo com os dados da
cotação de exemplo do robô → **COT-2026-00107**, 29 colunas, sem transmissão):
filtro de seção com os rótulos do portal ("Cotações para a cobertura
Compreensiva", "Ofertas adicionais", "Todas") e filtro funcionando; rótulo da
seção sob cada seguradora; "Sem retorno" com o motivo real do portal (Mapfre
faixa reduzida 50% "Risco Restrito", Pier erro 400, Itaú "Calculo Não
realizado"); botão Mensagens habilitado e abrindo as mensagens por faixa;
Allianz e Mapfre com as formas de pagamento reais; Bradesco com preço só em
"Débito em Conta" (as outras formas "—", antes vinham copiadas); Emissão com
"protocolo —" nas propostas antigas. O protocolo real só aparece na primeira
venda depois do deploy.

Achados do smoke test: a janela de Mensagens herdava da tabela o texto
centralizado e sem quebra de linha (corrigido no PR deste registro — os
modais da barra de ações vão para o `<body>`); vieram 2 "Sem retorno" de
produtos HDI não pedidos ("Falha no acionamento de cálculo, necessário
calculo da HDI") — conferir no log do robô de produção as linhas de
"desmarc" da seleção de seguradoras.

**29/09/2026 (2ª rodada do dia) — Impressão com comissão (fatia B) e tutorial
(PRs #245, #247, #248):** duas migrations aplicadas pelo usuário com o roteiro
em psql (cada uma numa transação, com o `insert` em `schema_migrations`),
ensaiado antes do zero no banco local num bloco desfeito com `rollback`:
`20260929050000_v12_impressao_registro` (tabela `cotacao_impressoes`,
imutável, sem FK para a cotação, e `rpc_registrar_impressao`) e
`20260929050100_v12_impressao_rpc_comissao` (`rpc_comissao_para_impressao`).
Sem `pg_dump`: as duas só criam objetos novos. Conferência esperada e
confirmada: as duas versões no histórico, a tabela criada, as duas funções e
`fn_pct_comissao_efetivo` ainda **sem** EXECUTE para `authenticated`. Imagem do
app publicada pelo usuário via `deploy.sh` (o merge do #248 é `d98096f`, tag
informada como já publicada; ele inclui o #245, a correção da coluna "HDI sem retorno" duplicada, e o #247, o
passo do filtro de cobertura no tutorial).

Smoke test pelo navegador (vendedor real, COT-2026-00107, sem gravar nada):
com a Matriz **sem** percentual, "Imprimir comissão" aparece desabilitado com
"% de comissão não cadastrado" (a função devolve NULL em vez do 16 de reserva).
Depois de cadastrar `perc_comissao = 16` na Matriz (mesmo valor que o motor já
usa como reserva, então nenhuma comissão muda) o checkbox habilita, a
pré-visualização vira o documento interno (faixa "USO INTERNO — NÃO ENVIAR AO
CLIENTE" e "Comissão da corretora 16,00%") e E-mail, SMS, WhatsApp e Gerar link
ficam desabilitados com o aviso. Depois do teste o usuário desfez o cadastro
(`perc_comissao = null`): a Matriz voltou a ficar sem percentual, como antes.
"Baixar PDF" não foi acionado em produção (grava uma linha de auditoria
imutável); a gravação e o caso de falha estão cobertos pelos testes
automáticos.

Achado: hoje as propostas da Matriz são comissionadas pelo 16% de reserva — a
Matriz não tem `perc_comissao` nem modelo. O percentual não tem tela no app: é
`empresas.perc_comissao` (por empresa) ou `modelos_franquia.perc_comissao_padrao`
(por modelo; modelos criados pela tela nascem com 0%) e só se altera pelo banco.

**30/09/2026 — V12.3.7 Personalizar coberturas por seguradora (PRs #251 e
#252):** uma migration aplicada pelo usuário com o roteiro em psql (numa
transação, com o `insert` em `schema_migrations`), ensaiada antes do zero no
banco local num bloco desfeito com `rollback`:
`20260929060000_v12_seguradora_ajustes` (tabela `cotacao_seguradora_ajustes`,
RPCs `salvar_ajuste_seguradora`, `marcar_ajuste_aplicado`,
`marcar_ajustes_nao_aplicados` e a função interna `fn_cot_seg_ajuste_acesso`,
sem EXECUTE para `authenticated`). Sem `pg_dump`: só cria objetos novos. Imagens
do app publicadas pelo usuário via `deploy.sh`: o merge do #251 (`98d5adc`) e,
depois, o do #252 (`0ededf7`), sem migration. Nada muda no robô.

Teste de ponta a ponta em produção, com autorização explícita do usuário, na
COT-2026-00107 (lead de teste): (1) "Personalizar coberturas" da Porto com a
1ª opção de franquia em "Reduzida 75%" → a confirmação citou o ajuste; foi enviada
**uma cotação real só para a Porto** (resultado em 3 min 37 s); a "Análise do envio"
mostrou "Ajustada para porto: franquia Reduzida 75%" e "Seguradoras selecionadas:
porto"; a janela de Mensagens listou a faixa "reduzida 75%" (antes a 1ª opção era
"normal 100%"), e o selo "personalizada" apareceu nas colunas da Porto. O portal
devolve o grupo inteiro ao pedir "porto" (Porto, Azul, Itaú e Pier), então vieram
também as colunas da Azul e da Itaú, e a Pier "sem retorno". (2) Recálculo geral
com as 10 seguradoras (3 min 47 s, 28 colunas) → o selo "personalizada" sumiu e o
ajuste ficou guardado como "não aplicado".

Achados: (a) o ajuste era lido e gravado com nomes diferentes nas duas entradas —
o modal do Cálculo usa o nome do robô (`porto`) e o bloco de Coberturas o nome do
formulário (`Porto`, `HDI`) — e o servidor busca por igualdade exata, então um
ajuste feito no bloco nunca seria encontrado ao recalcular pelo Cálculo; corrigido
no #252 com o nome canônico como chave (o servidor também acha linhas antigas
com nome de exibição), e conferido em produção: o bloco passou a mostrar a Porto
com "Reduzida 75%". (b) "Recalcular só esta seguradora" deixa só ela marcada no
passo Seguro; um "Recalcular" geral em seguida repete só essa seguradora até o
vendedor marcar as outras de novo (comportamento da V12.3.6, ainda não tratado).
(c) O rótulo da primeira linha de parcelas na lista comparativa vem da primeira
coluna, e não de cada coluna, e pode mostrar "Sem Franquia" para colunas que estão
em "reduzida 75%" (ainda não tratado).

### 6.7 Marcar os 2 diretores iniciais (regra 2 das Regras Decididas)

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

### 6.8 Robô Quiver (outra máquina)

O robô que cota e transmite no portal Quiver roda em **outra máquina da AWS**
("cotecerto"), não no servidor do app. É ele que responde em
`https://quiver-bot.sandboxallcom.com` (`SELF_QUIVER_API_URL` do app, §4). Não
há CI publicando imagem do robô: o deploy é no checkout do repositório
`playwright` nessa máquina.

```bash
git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api
```

- Faça em horário sem cotação nem transmissão em andamento: o `--build`
  recria o container e derruba o que estiver rodando.
- Confira a versão com `git log --oneline -1` (o commit de merge do PR).
- Os campos novos do webhook do robô são opcionais: robô e app podem subir em
  qualquer ordem. Variáveis novas, quando houver, entram no `.env` dessa
  máquina (ver `.env.example` do robô).
- A conta do portal é de produção: cada cotação é real. Nunca rodar
  `transmissao.spec.ts` nem `npm run test` para testar.

### 6.9 V12.4.7 fatia 2 — documento (PDF) da proposta

Ordem: **migration antes da imagem** (§6.3).

1. Aplicar `20260930185711_v12_proposta_documentos.sql` (tabela `proposta_documentos`,
   bucket privado `propostas-docs`, RPCs só `service_role`) e registrar no histórico (§3.5).
2. Acrescentar ao `.env` protegido do app (sem commitar valores):
   `SELF_QUIVER_DOCUMENTO_WEBHOOK_CLIENT_KEY` e `SELF_QUIVER_DOCUMENTO_WEBHOOK_CLIENT_SECRET`
   (gere valores novos e longos; distintos dos demais webhooks).
3. **nginx**: o PDF chega em base64 (até ~14 MB). Liberar 15 MB **somente** nesta rota,
   no bloco `cote-certo` (443), acima do `location /`; o resto do site mantém o limite padrão:

```nginx
location = /api/webhooks/quiver-documento {
    client_max_body_size 15m;
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

Depois: `sudo nginx -t && sudo systemctl reload nginx`.

4. Publicar a imagem (§6.4). O app chama o robô em `POST {SELF_QUIVER_API_URL}/documento/capturar`
   (`{cotacaoId, numeroCotacao}`, espera 202) com as mesmas `SELF_QUIVER_TRANSMISSAO_CLIENT_KEY/SECRET`
   da transmissão.
5. **Robô** (outra máquina, §6.8): o `.env` dele precisa das **mesmas** chaves do webhook
   novo (valores iguais aos do passo 2) e da URL `https://cote-certo.sandboxallcom.com/api/webhooks/quiver-documento`.
   **Ordem:** migration → **robô** (`git pull` + `docker compose … up -d --build api`, com as envs
   `WEBHOOK_DOCUMENTO_*`) → imagem do app. Com o app no ar e o robô antigo, a recaptura falha ao chamar
   `/documento/capturar` e o documento fica pendente até o limite de 5 min para tentar de novo.
6. Smoke: webhook sem credenciais responde 401; com credenciais e corpo vazio, 400.
   Não enviar PDF real de teste para produção.

### 6.10 Deploy de 04/10/2026 — nome social/e-mail opcionais, seleção de seguradoras e ajustes de formulário

**Versões publicadas:** robô `master` em `5b70bbe` (PRs #46, #47, #48, #49 do `playwright`) e app em
`sha-105411f` (PRs #262, #264, #265, #266, #267, #269, #270, #271 do `cotecerto33`). **Sem migration** e
sem env nova. Ordem seguida: **robô primeiro**, depois o app (o app novo deixa de exigir e-mail e envia
`email` na transmissão; o robô antigo recusaria cotação sem e-mail e ignoraria o `email` da Efetivação).

| Frente                    | Robô                                                                                                           | App                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Nome social opcional      | #46: `nomeSocial` ausente aceito; a Página 1 deixa o campo em branco                                           | #264: rótulo "(opcional)"; o payload nunca manda o nome civil como nome social                                 |
| CEP de circulação         | #47: espera de 8 s cai para ~1 s (o portal só mostra Residencial e Pernoite)                                   | #265: campo removido; o envio manda o pernoite nos dois campos                                                 |
| E-mail e número opcionais | #48: `email` opcional na cotação; a Efetivação preenche o e-mail quando vem                                    | #269: opcionais no passo 1, obrigatórios no passo 7, validação no servidor e gravação de volta                 |
| Seleção de seguradoras    | #49: marca as pedidas, desmarca as demais (inclui a **Pier**, que era sempre calculada) e loga as fora do mapa | #270: o Calcular não envia se a gravação do rascunho falhar                                                    |
| Formulário                | —                                                                                                              | #266 tipo de cobertura legado, #267 gate do zero km, #271 rótulo "Acessórios", #262 Confirmação fiel ao Quiver |

**Conferência em produção** (feita depois dos dois no ar; resultado na tabela abaixo):

| #   | Teste                                                                         | Como conferir                                                                                  |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Cotação sem e-mail e sem nome social calcula normalmente                      | Resultado volta com ofertas; log do robô: "E-mail não informado" e "Nome social não informado" |
| 2   | "Marcar todas" no passo 2 e calcular: o robô recebe as 10                     | `grep "Seguradoras solicitadas" logs/<arquivo da cotação>.txt` na máquina do robô              |
| 3   | Pedido só da Suhai: a Pier não aparece como "sem retorno"                     | Comparativo sem a coluna da Pier; log "Estado final das seguradoras"                           |
| 4   | Transmissão de lead sem e-mail: o passo 7 pede o e-mail e a Efetivação o leva | Passo 7 com E-mail editável e obrigatório; proposta transmitida                                |

**Resultados (04/10/2026, produção, lead de teste `COT-2026-00114`, seu CPF e placa FTP4J82, sem e-mail, sem nome social e sem número):**

| #   | Resultado                    | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | OK                           | Passo 1 avançou com os três campos em branco ("(opcional)" nos rótulos); o Calcular enviou sem erro e o resultado voltou com 25 colunas de oferta de 11 seguradoras. O passo 3 já não tem "CEP de circulação"                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2   | OK                           | "Marcar todas" mostrou "10 de 10"; o log do robô confirma `Seguradoras solicitadas` com as **10** (mapfre, aliro, yelum, hdi seguros, suhai, porto, azul, tokio, allianz, bradesco) e ofertas voltaram de 11 seguradoras. Pier desmarcada nas duas passagens de seleção                                                                                                                                                                                                                                                                                                                                                                          |
| 3   | OK                           | Nenhuma coluna da Pier no comparativo (antes aparecia "pier sem retorno" até em cotação só da Suhai)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4   | OK (falta só o aviso do log) | Lead sem e-mail e sem número: o passo 7 exigiu os dois ("Informe o e-mail." / "Informe o número.") e bloqueou o Efetivar; depois de preenchidos, a transmissão real na Suhai concluiu em poucos minutos (PRP-00114, protocolo capturado) e o "Proposta (PDF)" ficou pronto (PDF válido de ~250 KB). Banco: `cotacao_segurado` ficou com número 121 e e-mail gravados de volta. Robô: o pedido de transmissão recebido (`data/requests/transmissao-*.json`) traz `email` e `numeroEndereco: 121`. **Falta** só ver que o log da transmissão não tem aviso de campo de e-mail não encontrado (o preenchimento do campo não grava linha de sucesso) |

**Observação (HDI Fit e Básico):** com a HDI Seguros pedida, o robô desmarca Fit (10051) e Básico (10052) na Página 2
(confirmado no "Estado final"), mas na segunda passagem (Calcular, Página 5) as duas voltam **marcadas**: o portal as
remarca junto com a HDI e o robô não clica em seguradora invisível. Na prática a HDI é calculada com as 3 variantes, como já
aceito em setembro. O aviso "NÃO pedida … segue MARCADA — pode ser calculada" é esperado nesse caso (ajuste proposto no
robô: rebaixar para info quando a HDI Seguros é pedida).

**Rollback:** app pela tag anterior (`IMAGE_TAG=<sha anterior> ./deploy.sh`); robô com `git checkout <commit anterior>` e o mesmo
`docker compose … up -d --build api`. O robô novo é retrocompatível com o app antigo, exceto a Efetivação sem o `email`.

### 6.11 Carga das lojas Movida por vendedor (05/10/2026)

**05/10/2026 — migration `20261005044324_carga_lojas_movida_por_vendedor` (PR #274):**
só dados, sem mudança de schema; **sem rebuild nem redeploy do app**. O servidor é
um container direto do git (sem `git pull`), então o SQL foi colado no `psql` do
container do banco (`supabase-db`) por heredoc, numa transação com o `insert` em
`schema_migrations`, ensaiado antes com `rollback` e aplicado trocando por
`commit`. Cria/reaproveita 47 lojas Movida + Loja Web na Matriz e liga cada loja
ao vendedor da carteira (Everton 12, Wesley 12, Katia 8), achado por nome entre os
vendedores aprovados da Matriz. Idempotente.

- Ana Beatriz (SP3) e André (SP4) não eram vendedores em produção ("Beatriz" é
  Supervisor de Vendas): o ensaio e a aplicação deram o aviso "0 correspondência(s)"
  e as lojas deles (16) e a Loja Web ficaram sem vendedor. Lead de loja inativa ou
  sem vendedor elegível não é distribuído e cai na fila global da Matriz.
  **Pendência:** cadastrar os dois como vendedores aprovados da Matriz (nome
  começando por "Ana Beatriz" / "André") e rodar a migration de novo.
- A carga só adiciona ao pool, nunca remove: havia vínculos antigos (Everton em
  Americana, Penha, Praia Grande e Santos; Wesley em Mogi das Cruzes e Suzano;
  Mirelle Lima Dias, que saiu da empresa, em São Miguel Paulista e Radial Leste).
  Desativados à mão (`update movida_loja_vendedores set ativo = false`, `UPDATE 8`),
  sem apagar. Conferido: vínculos ativos Everton 12, Wesley 12, Katia 8.
- A Mirelle continua como vendedora aprovada; desligá-la na tela de acessos.

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

| Sintoma                                                                    | Causa                                                                                                                                                                                                                                          | Correção                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permission denied for table job` na migration 030                         | `postgres` sem acesso a `cron.*` no self-hosted                                                                                                                                                                                                | GRANTs como `supabase_admin` (§3.3)                                                                                                                                                                                                                                                                                                                                                                                           |
| `invalid command \restrict` / `unrecognized parameter transaction_timeout` | `pg_dump` (cliente PG17) gera SQL incompatível com Postgres 15                                                                                                                                                                                 | não vendorizar a seção do `pg_dump`; gerar histórico à mão (§3.5)                                                                                                                                                                                                                                                                                                                                                             |
| `unauthorized` no `docker pull`                                            | login no GHCR não feito / PAT sem `read:packages`                                                                                                                                                                                              | `docker login ghcr.io` com PAT correto (§4)                                                                                                                                                                                                                                                                                                                                                                                   |
| porta 3000 ocupada                                                         | Kong (Supabase) já usa a 3000 do host                                                                                                                                                                                                          | publicar o app em **3001**                                                                                                                                                                                                                                                                                                                                                                                                    |
| login não conecta                                                          | anon key embutida ≠ anon key do Supabase                                                                                                                                                                                                       | conferir fingerprint (§4)                                                                                                                                                                                                                                                                                                                                                                                                     |
| `MAILER_OTP_EXP` no `.env` não muda a validade do link                     | a distribuição self-hosted não mapeia `GOTRUE_MAILER_OTP_EXP` no `docker-compose.yml` — só `GOTRUE_SITE_URL` e `GOTRUE_URI_ALLOW_LIST` vêm mapeados por padrão                                                                                 | adicionar `GOTRUE_MAILER_OTP_EXP: ${MAILER_OTP_EXP}` no serviço `auth` do `docker-compose.yml` (mesmo lugar do §6.2), antes de `--force-recreate auth` — confirmado em produção em 01/08/2026                                                                                                                                                                                                                                 |
| `column ... does not exist` ao aplicar uma migration incremental atrasada  | PRs mergeados fora de ordem: uma migration mais antiga (ex. `20260821010000`) fica pendente enquanto uma mais nova (ex. `20260822000000`) já foi aplicada — e a mais antiga recria uma função referenciando colunas que a mais nova já removeu | não aplicar os arquivos crus em sequência; monte um script combinado que pula o `CREATE OR REPLACE FUNCTION` das migrations intermediárias (mantendo só a DDL de cada uma) e usa a função da migration **mais recente** por último. Registre todas as versões no histórico mesmo assim (§3.5) — validado num banco local simulando o estado real da produção antes de rodar de verdade (confirmado em produção em 22/08/2026) |
