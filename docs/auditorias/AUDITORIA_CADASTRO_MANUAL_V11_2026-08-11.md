# Cadastro manual — validação, campo Equipe e ordem dos campos · 11/08/2026

## Telas verificadas

Só existem dois modais de "cadastro manual" (criação sem passar pelo Convite Supper) no app —
verifiquei os dois contra o protótipo (`cotecerto_prototipo_v11.html`):

1. **`CadastroManualModal`** (`src/components/acessos/cadastro-manual-modal.tsx`) — "Cadastro manual
   · exceção" da **Matriz**, nos dois blocos (Time interno e Externos · Rede). É o mesmo modal
   para os dois, com `isExterno` alternando os campos — igual ao protótipo (`openManualCad`,
   linha 8220).
2. **`FullDirectModal`** (`src/components/operacao/acessos/full/full-direct-modal.tsx`) —
   "Cadastro direto" da **Franquia Full**, equivalente ao `openCadDireto` do protótipo (linha
   8543).

Master e Franquia Individual não têm cadastro manual: Master só convida (Convite Supper); Full
Individual "opera como um vendedor", sem equipe para cadastrar.

## Achados

### 1) Ordem dos campos — já batia com o protótipo

Em `CadastroManualModal`, o select "Documento" (PJ/PF, só no bloco Externo) já vem **antes** dos
campos de texto (Nome, CPF/CNPJ, Celular, E-mail) — confirmei no DOM renderizado. É a mesma ordem
do protótipo. `FullDirectModal` não tem nenhum `<select>` (produtos/canais são pills, não select) —
nada a reordenar ali.

### 2) Validação de e-mail/telefone — faltava no `CadastroManualModal`

`FullDirectModal` já valida e-mail e celular via zod (`full-direct-schema.ts`) — não precisou de
mudança.

`CadastroManualModal` só checava se nome/documento/e-mail estavam **preenchidos**, sem checar
**formato**. Um e-mail ou celular incompletos/inválidos só seriam pegos depois de round-trip pro
servidor (a RPC/`cadastro.functions.ts` já valida com `cadastroManualSchema`, de
`src/lib/schemas/cadastro.schema.ts` — esse schema já existia, criado para esta tela, mas nunca
tinha sido importado nela).

**Correção:** o modal agora chama `cadastroManualSchema.safeParse(...)` antes de enviar — mesmo
schema do servidor, então o erro aparece na hora, sem esperar a resposta da RPC. Também adicionei
máscara ao digitar em documento (`maskCpfCnpj`) e celular (`maskTelefone`), que antes eram texto
livre sem formatação — mesmo padrão dos outros formulários de cadastro do app.

### 3) Campo "Equipe" — removido e depois trazido de volta como select, igual ao protótipo

`CadastroManualModal` nunca teve campo Equipe — nada a mudar ali.

`FullDirectModal` tinha "Equipe" como texto livre. Numa primeira rodada, removi o campo a pedido.
Comparando com o protótipo (`openCadDireto`, linha 8550), ele tem "Equipe" como **select** com
duas opções fixas — "Novas Vendas" / "Remalho" — não texto livre. Voltei o campo, mas como select
com essas duas opções (`EQUIPES_FULL` em `full-direct-schema.ts`), igual ao protótipo — só que
mantendo a posição na etapa 2 (Configuração), já que a divisão em 2 etapas (identidade → config)
é uma decisão de arquitetura anterior a esta auditoria, e o protótipo já teria a ideia de mandar
`equipe`/leads/comissão para "a próxima tela" mesmo sendo, no protótipo, apenas uma sugestão.
`p_equipe` na RPC (`fn_cadastrar_vendedor_full`) já tinha `default null` — não precisou de
migration.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 363/363 (`full-direct-schema.test.ts` cobre o enum de Equipe e rejeita
  valor fora da lista).
- `playwright test tests/e2e/franquia-full-v11-5c.spec.ts -g "fluxo cadastro direto"`: passa
  isolado, selecionando "Remalho" no select e confirmando no banco. 2 falhas pré-existentes e não
  relacionadas (poluição de dados do Supabase local compartilhado entre worktrees) continuam
  ocorrendo quando a suíte inteira roda junto — confirmado que já falhavam em `main`.
- Verificação visual manual: `CadastroManualModal` (Matriz, bloco Externo) rejeita e-mail e
  celular inválidos com mensagem imediata.
