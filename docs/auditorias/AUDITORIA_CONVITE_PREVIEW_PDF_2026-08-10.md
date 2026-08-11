# Convite Supper — pré-visualização da arte do PDF · 10/08/2026

## Pedido

"Na tela de Convite: Pré-visualizar a arte do PDF. Igual no protótipo."

## Referência no protótipo

`cotecerto_prototipo_v11.html` (r40) — `openConvite`/`cvGerar`/`cvArteHTML`: ao clicar em
"Gerar mensagem" (`cvGerar()`), além de montar a mensagem de WhatsApp, o protótipo exibe
automaticamente um `<iframe>` com o HTML compacto do card do convite (`cvArteHTML(d, true)`),
sob o rótulo "Pré-visualização do convite (PDF)". Não é um botão separado — a prévia aparece
junto com a mensagem gerada.

## Implementação

O app atual (`src/lib/convite-pdf.ts`) desenha o PDF com primitivas do jsPDF (não a partir de
HTML — ver comentário do arquivo sobre preservar o link clicável), então não havia um template
HTML pronto para reaproveitar num iframe. Em vez de recriar um HTML string, criei o componente
`ConvitePreview` em `src/components/acessos/convidar-modal.tsx`: um card em JSX/CSS que
reproduz o mesmo layout do PDF (cabeçalho slate com logo + "CONVITE SUPPER", saudação, pílula
amarela com o tipo declarado, box "COMO FUNCIONA" com borda amarela, link em caixa creme,
aviso de nominal/uso único, rodapé escuro "SUPPER CERTO · PLATAFORMA COTE CERTO"), usando as
mesmas variáveis de cor do `proto.css` (`--slate`, `--yellow`, `--cream`, `--ink`, `--muted`,
`--border-soft`) — a mesma paleta documentada em `convite-pdf.ts`.

A prévia é renderizada automaticamente assim que `dadosPdf` é preenchido por `gerar()` (mesmo
gatilho de "Gerar mensagem" do protótipo), com o rótulo "Pré-visualização do convite (PDF)"
posicionado entre a mensagem de WhatsApp e o aviso de uso único.

## Verificação

- `tsc --noEmit`: limpo.
- `eslint .`: 0 erros.
- `vitest run tests/unit`: 353/353.
- `bun run test:db`: sem regressão (mudança é só de UI, sem RPC/RLS envolvida).
- `playwright test tests/e2e/personas.spec.ts`: 7/7.
- Verificação visual: persona Matriz, escopo "Convidar · time interno", cargo Coordenador
  Comercial — ao clicar em "Gerar mensagem", o card de pré-visualização aparece imediatamente
  com o layout completo (cabeçalho, pílula, passos, link, aviso, rodapé).
