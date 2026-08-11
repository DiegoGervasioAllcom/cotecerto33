# Ajustes no formulário de cadastro por Convite Supper · 11/08/2026

Mudanças pedidas na tela `/convite/$token` (a que é enviada por convite), afetando
`src/lib/cadastro-campos.ts`, `src/lib/schemas/cadastro.schema.ts`, `src/components/auth/campos-cadastro.tsx`
e `src/routes/convite.$token.tsx`.

## Pedidos e o que foi feito

1. **RG obrigatório** — `rg` (PF) e `socio_rg` (PJ) passam a ser `required: true`, com validação
   `min(1)` no schema (antes eram opcionais, só limitados por tamanho).
2. **Data de nascimento obrigatória** — `data_nascimento` (PF e PJ) agora exige valor não vazio.
3. **Celular obrigatório** — `celular` (PF e PJ) agora exige 10-11 dígitos, não aceita vazio.
4. **Contato de emergência obrigatório e como última pergunta** — só existe no formulário PF
   (PJ nunca teve esse campo, igual ao protótipo). Passou a ser `required: true` e foi movido
   para o final da lista de campos (depois de Banco/Agência/Conta).
5. **Logo da Supper cortado** — bug real, reproduzido e corrigido. `.auth-stage` (`proto.css`)
   tinha `max-height: 96vh`; como o formulário de PF tem ~12 perguntas e ultrapassa essa altura,
   o topo do conteúdo (a marca/logo) ficava posicionado **acima** da viewport — o navegador não
   rolava a página para revelar o início, só o restante do conteúdo abaixo. Troquei
   `max-height: 96vh` por `min-height: 100vh`: telas curtas (login) continuam preenchendo a tela
   toda; telas longas (convite) crescem e rolam normalmente pela página, com a logo sempre visível
   no topo. O formulário em si mantém o próprio scroll interno (`.auth-form { max-height: 54vh;
   overflow-y: auto }`), que já existia e não foi tocado — é dele que vem a barrinha de scroll
   dentro do card.
6. **"E-mail" → "E-mail pessoal"** — label trocado nos dois modelos (PF e PJ).
7. **Banco / Agência / Conta separados** — o campo único `dados_bancarios` (texto livre "Banco 000
   · Ag 0001 · CC 00000-0") virou 3 campos (`banco`, `agência`, `conta`). Como a coluna no banco
   (`empresas.dados_cadastro->>'dados_bancarios'`) e a leitura em "Formulário completo"
   (`FORM_FIELDS_BY_TIPO` em `constants.ts`) continuam esperando um texto único, o envio
   (`convite.$token.tsx`) combina os 3 campos de volta em `dados_bancarios` antes de mandar pra
   `cadastrar_franquia_admin` — nenhuma migration foi necessária.
8. **Removida a senha do formulário** — o cadastro por convite pedia senha na hora (`Senha de
   acesso`), mas isso é redundante: depois da aprovação, `enfileirar_boas_vindas` já manda um
   e-mail Boas-vindas com um link de recovery de uso único que leva à tela `/auth/criar-senha`.
   A pessoa nunca via nem precisava da senha que digitava aqui. Removido o campo, a validação e o
   parâmetro do lado do servidor; `cadastrarPorConvite` (`convite.functions.ts`) agora gera uma
   senha aleatória e descartável (`crypto.randomUUID()` duplo) só para satisfazer a exigência do
   Supabase Auth de toda conta ter uma senha — ninguém nunca vê ou usa essa senha, o fluxo real de
   acesso é sempre pelo link do e-mail.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 358/358 (atualizei `tests/unit/schemas-cadastro.test.ts` para os novos
  campos obrigatórios e a remoção de senha/dados_bancarios).
- `playwright test tests/e2e/personas.spec.ts`: 7/7.
- Verificação visual: convite PF e PJ mostram os campos certos, na ordem certa, com `*` nos
  obrigatórios, sem campo de senha, e o logo aparece por completo no topo.
- Envio real (persona de teste, convite PF): `empresas.dados_cadastro` confirmado com
  `dados_bancarios: "Banco 260 · Nubank · Ag 0001 · CC 00000-0"` (a partir dos 3 campos
  separados) e sem qualquer chave de senha.
