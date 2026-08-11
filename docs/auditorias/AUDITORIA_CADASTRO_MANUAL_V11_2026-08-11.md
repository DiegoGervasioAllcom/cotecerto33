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

### 3) Campo "Equipe" — trazido de volta como select, igual ao protótipo

`CadastroManualModal` nunca teve campo Equipe — nada a mudar ali.

`FullDirectModal` tinha "Equipe" como texto livre. Comparando com o protótipo (`openCadDireto`,
linha 8550), ele tem "Equipe" como **select** com duas opções fixas — "Novas Vendas" / "Remalho".
Trocado para select com essas opções (`EQUIPES_FULL` em `full-direct-schema.ts`).

### 4) Aviso do `FullDirectModal` — texto incompleto vs. protótipo

O aviso do protótipo diz: *"Cadastro direto — autonomia da Full. Na próxima tela você configura
equipe, leads, produtos e canais; só ao concluir ele recebe o e-mail Boas-vindas Supper para
criar a senha. **Prefira o Convite Supper: quem preenche os dados é ele.**"* — o app só tinha uma
frase genérica sobre o link de senha. Corrigido para o mesmo texto.

### 5) Estrutura em 2 etapas → 1 tela só, igual ao protótipo

O protótipo (`openCadDireto`) é uma **tela só**: Nome, CPF, Celular, E-mail, Equipe — o botão
("Continuar para configuração") já manda pra aprovação (`openFullApprove`), onde entram
leads/produtos/canais/comissão. O app tinha isso partido em 2 etapas **dentro do mesmo modal**
(identidade → configuração).

**Correção:** `FullDirectModal` voltou a ser 1 tela só (Nome, CPF, Celular, E-mail, Equipe),
chamando `cadastrarVendedorFullDireto` só com a identidade (produtos/canais vazios,
leads/comissão indefinidos — todos já opcionais na RPC). Como o app não tem uma tela de
"aprovação" separada pra Full (ela aprova o próprio time direto, sem fila), a "próxima tela" do
protótipo virou: `xacessos.tsx` guarda o id do vendedor recém-criado (`pendingConfigureId`),
recarrega a lista (`useTeamData`), e assim que o vendedor aparece nela, abre **automaticamente**
o modal "Configurar" (`FullMemberModal`, já existente, sem nenhuma mudança) — igual ao
`cadDiretoNext() → openFullApprove()` do protótipo, sem o usuário precisar procurar a linha na
tabela.

`cadastroDiretoFullSchema` (client) perdeu `leadsDia`/`comissaoVenda`/`comissaoRenovacao` — esses
campos agora só existem no schema do `FullMemberModal` (`configSchema`), que já existia e não foi
tocado.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 362/362 (`full-direct-schema.test.ts` simplificado pra 1 tela; o schema
  de identidade+equipe cobre o enum e rejeita valor fora da lista).
- `playwright test tests/e2e/franquia-full-v11-5c.spec.ts`: os 2 testes que tocam o cadastro
  direto/configurar passam isolados (reescrevi o fluxo de teste pra 1 tela → Configurar
  automático → preencher leads/comissão → salvar → confirmar no banco). 1 falha pré-existente e
  não relacionada (poluição de dados do Supabase local compartilhado entre worktrees) continua
  ocorrendo quando a suíte inteira roda em série — confirmado que já falhava em `main`, e por ser
  `describe.serial` ela impede os testes seguintes de rodar nesse modo (mas passam isolados).
- `bun run test:db`: passou.
- Verificação visual manual: `CadastroManualModal` (Matriz, bloco Externo) rejeita e-mail e
  celular inválidos com mensagem imediata; `FullDirectModal` confirmado como 1 tela só com o
  aviso completo do protótipo.
