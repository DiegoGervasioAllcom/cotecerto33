# Plano — Frente 6 · Governança e histórico

**Aberto em:** 03/08/2026 · **Status:** ✅ implementado e concluído (G6.1–G6.6, PR mergeado
03/08/2026)

**Escopo:** V11.6.1 a V11.6.5 do `PLANO_TASKS_V11.md`.

## O que existe hoje (levantamento, não é o que vamos construir)

A infra de V11.0.5/V11.0.6/V11.0.7 já está pronta e testada:
- `profiles.diretor boolean` + `fn_eh_diretor` + `fn_confirmar_senha_diretor` (senha de
  login, bcrypt via `extensions.crypt`) + trigger que impede ficar com menos de 2
  diretores.
- `historico_alteracoes` (append-only: trigger bloqueia UPDATE/DELETE/TRUNCATE pra
  qualquer papel, inclusive `service_role`) + `fn_registrar_alteracao(area, o_que,
  senha, de_para?, empresa_id?)`, que já devolve a mensagem exata pedida pela V11.6.2
  ("Seu acesso não permite esse tipo de alteração") quando a senha não confere.
- A régua de performance (Frente 4, D2) já é o primeiro consumidor real: RPC
  `fn_salvar_regua_performance` chama `fn_registrar_alteracao`, e o front tem
  `src/components/acessos/senha-diretor-modal.tsx` — modal reutilizável de senha,
  pronto para os outros 4 botões.
- **Não existe nenhuma tela hoje** que leia `historico_alteracoes` (é 100% infra sem
  consumidor de leitura) nem nenhuma UI para incluir/remover diretor (a marcação só
  pode ter sido feita direto no banco).

> **Atualização pós-implementação:** o parágrafo acima descreve o estado ANTES desta
> frente — G6.4/G6.5 fecharam exatamente essas duas lacunas (sub-aba Diretores com
> dupla aprovação, e tela Histórico). Além disso, `supabase/seed.sql` já cria a Ana e
> o Melo com `diretor = true` de fábrica em qualquer ambiente novo (dev local ou
> primeira carga de produção) — não é preciso nenhum `update` manual no banco para ter
> os 2 diretores mínimos num ambiente recém-criado; o `update` manual (comentado como
> "marcação só pode ter sido feita direto no banco") só é necessário em produção real,
> quando os diretores de fato são pessoas que já se cadastraram pelo convite (ver
> `docs/RUNBOOK_DEPLOY.md` §6.6).

### Os "9 botões" da V11.6.1 não são 9 hoje

O número vem do protótipo (array `GATED`, que envolve `saveCLT`/`saveModelosTudo`/
`saveSupervisorTudo`/`saveMasterTudo`/`salvarProdutos`/`saveDescPolicy` com `dirGate`)
— mas o app real de hoje só tem **4 botões de salvar política/config sem gate**
(as telas de Master/Supervisor com comissionamento por cargo do protótipo não existem
no app real ainda):

| Botão | Arquivo | Grava em |
| --- | --- | --- |
| "Salvar parâmetros" (Modelo Franquia) | `perso-geral.tsx` | `modelos_franquia` |
| "Salvar Modelo CLT" | `perso-geral.tsx` | `clt_config` |
| "Salvar política" (Desconto) | `desconto-politica-panel.tsx` | `desconto_politicas` |
| "Salvar"/"Criar" (Respostas padrão) | `respostas-padrao-panel.tsx` | `respostas_padrao` |

("Salvar régua", da Performance, já é gated desde D2 — não conta como pendente.)

### O gate real precisa ser no banco, não só no front

Hoje as 4 tabelas acima são escritas por **update/insert direto do client**
(`supabase.from(...).update(...)`), sem RPC. Só colocar o modal de senha na FRENTE
sem mudar o backend seria decorativo: a tabela continuaria aceitando escrita direta
de qualquer `authenticated` com a policy de matriz — nada impediria pular o modal e
chamar `.update()` direto. A V11.6.5 ("alteração sem diretor falha no backend")
confirma que o desenho pretendido é o mesmo de D2: `revoke` da escrita direta +
uma RPC `fn_salvar_X` por tabela, que chama `fn_registrar_alteracao` e só então
grava. Por isso V11.6.1, embora marcada "front" no `PLANO_TASKS_V11.md`, tem uma
perna de banco — registrado aqui pra não repetir a surpresa do C14/D4.

## Tasks

| Task | Tag | Descrição | Depende de |
| ---- | --- | --------- | ---------- |
| G6.1 | banco | 4 RPCs `fn_salvar_modelos_franquia`/`fn_salvar_clt_config`/`fn_salvar_desconto_politicas`/`fn_salvar_resposta_padrao` (singular — grava uma linha por vez, ver Risco #3 abaixo) — cada uma chama `fn_registrar_alteracao` (DE/PARA por campo, mesmo padrão de D2) e só então grava; revoke da escrita direta nas 4 tabelas para `authenticated` | — |
| G6.2 | front | Os 4 painéis passam a chamar as RPCs de G6.1 via `SenhaDiretorModal` (reusa D2) em vez de `.update()` direto — fecha V11.6.1/V11.6.2 (a mensagem de erro já é a certa, só precisa aparecer) | G6.1 |
| G6.3 | banco | Tabela `diretor_propostas` (alvo, ação incluir/remover, proposto_por, confirmado_por, status) + RPCs `propor_alteracao_diretor`/`confirmar_alteracao_diretor` (senha nos dois passos; quem confirma ≠ quem propôs; bloqueia remoção que deixaria menos de 2) | — |
| G6.4 | front | Sub-aba "Diretores" em Personalização geral (mesmo padrão de sub-aba da Performance, D7): lista diretores atuais, propor alteração, confirmar/rejeitar proposta pendente | G6.3 |
| G6.5 | banco+front | Tela "Histórico": lê `historico_alteracoes` (RLS já filtra por área/empresa visível); tabela Quando/Quem/Área/O que + "Ver DE/PARA"; filtro por área persistente em `localStorage` por usuário (mesmo padrão de `tutorial-provider.tsx`) | — |
| G6.6 | testes | Toda gravação das 4 RPCs de G6.1 gera linha em `historico_alteracoes` com DE/PARA; sem diretor ou senha errada falha nas 4; dupla aprovação de diretor (propor→confirmar, confirmar≠propor, trava dos 2 mínimos) | G6.1, G6.3 |

## Decisões que estou tomando, para você contestar

1. **"9 botões" tratado como "todos os botões de salvar política/config que existem
   hoje" (4), não um número fixo.** O protótipo tem telas (comissionamento por cargo
   de Master/Supervisor) que não existem no app real da V11 — perseguir "9" literal
   inventaria escopo que não foi pedido em nenhuma outra frente.
2. **O gate fica no banco (RPC + revoke), não só no front** — decisão já explicada
   acima; sem isso V11.6.5 não teria como ser verdade.
3. **"Diretores" (V11.6.4) entra como sub-aba de Personalização geral**, mesmo padrão
   da sub-aba Performance (D7) — não crio uma tela nova nem uso Configurações. A
   RLS de leitura do histórico já aceita `macessos` (área de Acessos e permissões),
   então a localização não muda quem consegue ver.
4. **Filtro por área do Histórico persiste em `localStorage` por usuário**, não em
   query param — "sobreviver a reload" é o requisito literal da task; query param
   sobrevive a reload mas não a "voltar depois" numa aba nova, e não há um padrão
   combinado dos dois hoje no app (levantei os dois padrões existentes: nenhum faz as
   duas coisas).
5. **Histórico é só leitura — nenhuma edição, nem por diretor.** É o que a tabela já
   garante (append-only, imutável mesmo pra `service_role`); a tela só precisa não
   fingir que existe algum botão de editar/excluir.

## Riscos

1. **Dupla aprovação de diretor nunca foi implementada nem testada em produção.**
   Primeira vez que alguém de fato inclui/remove um diretor pela tela — vale rodar
   com atenção no primeiro uso real (o histórico registra as duas assinaturas, mas
   não há como "desfazer" um erro nem no banco — é append-only).
2. **Revoke da escrita direta nas 4 tabelas de G6.1 é mudança de comportamento
   visível** para quem hoje edita por essas telas — mesmo risco já observado em C6
   (trava de exclusão nova em produção). Se algum fluxo automatizado ou script externo
   escrever direto nessas tabelas (fora da tela), vai parar de funcionar — não
   encontrei nenhum no repo, mas registro o risco.
3. **`respostas_padrao` tem edição inline por linha** (sem um botão "Salvar" global,
   diferente dos outros 3) — a RPC de G6.1 pra essa tabela precisa decidir se grava
   histórico por linha editada (mais granular, mais ruído) ou só quando o usuário
   sai da tela/confirma em lote. Vou tratar cada edição de linha como uma gravação
   própria (mais simples, mais fiel ao "toda gravação gera histórico" da V11.6.5) —
   se ficar barulhento demais no Histórico, ajustamos depois.

## Sequência

G6.1 (RPCs + revoke) → G6.2 (front dos 4 painéis) → G6.3 (banco da dupla aprovação)
→ G6.4 (front de Diretores) → G6.5 (Histórico, independente das outras) → G6.6
(testes, fecha tudo).
