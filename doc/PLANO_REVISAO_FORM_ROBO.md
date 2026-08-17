# Plano — Corrigir divergências Formulário × Robô Quiver

Base: `doc/REVISAO-FORM-VS-CONTRATO-ROBO-2026-08.md` (revisão de 16-17/08/2026).
Fora de escopo aqui: `doc/TASK-webhook-resultado-transmissao.md` (fica para depois).

Fluxo por onda: planejador → front/testes → revisor (AGENTS.md).

## Onda 1 — Correções isoladas, baixo risco ✅ mergeada (PR #176)

| Task | Descrição | Arquivo |
|---|---|---|
| R.1 | ✅ RCF vazio: trocar `?? undefined` por checagem explícita de string vazia → `undefined` | `quiver.functions.ts:306-307` |
| R.2 | ✅ Remover máscara `R$` residual nos 11 campos monetários que ainda vazam | `quiver.functions.ts:199,205,213,222` |
| R.3 | ✅ Seguradoras não suportadas pelo robô: **removidas da lista de seleção** (decisão do usuário, 17/08/2026) — não oferecer a opção em vez de descartar em silêncio depois | `quiver.functions.ts:70-74,160` + `novo-lead.tsx` |
| R.4 | ✅ `premioNumerico()`: aplicado o mesmo fallback do PR #175 (extrair de `parcelas` quando `avista` ausente) | `quiver-resultado.ts:78-85` |

## Onda 2 — Correções de UI com impacto direto no formulário ✅ mergeada (PR #177)

| Task | Descrição | Arquivo |
|---|---|---|
| R.5 | ✅ Enum `cobertura.plano` corrigido (`Personalizada` → `Personalizado`); segundo select duplicado de `StepSeguro.tsx` isolado num campo próprio (`categoriaCoberturaLegado`), parou de sobrescrever `tipoCobertura` | `enumsCoberturas.ts`, `StepSeguro.tsx`, `types.ts` |
| R.6 | ✅ Opção vazia real adicionada nos selects de RCF | `StepCoberturas.tsx` |
| R.7 | ✅ Valores órfãos corrigidos: toggles de acessórios e antifurto agora removem do estado os campos do grupo desligado | `AcessoriosFold.tsx`, `DadosComplementaresFold.tsx` |

## Onda 3 — Fluxo de Renovação (maior gap) ✅ mergeada (PR #178)

| Task | Descrição | Arquivo |
|---|---|---|
| R.8 | ✅ `montarPayloadQuiver` envia o bloco "apólice anterior" (7 campos) quando `tipo_seguro` contém "Renovação". 2 campos reaproveitam colunas legadas (`cia_atual`/`apolice_atual`); os outros 5 ganharam coluna nova em `cotacao_seguro` (migrations `20260817010000`/`20260817020000`) | `quiver.functions.ts`, `useCotacaoRascunho.ts` |

## Onda 4 — Gate de cálculo e CPF/CNPJ ✅ mergeada (PR #179)

| Task | Descrição | Arquivo |
|---|---|---|
| R.9 | ✅ `podeCalcular` reescrito para exigir os campos reais do robô (`placa`, `email`, `cep`, `celular`, `cepPernoite`, `cepCirculacao`, `kmMensal`), sem mais depender de marca/modelo/ano | `useSimulacaoCalculo.ts` |
| R.10 | ✅ CPF/CNPJ: avanço da etapa Segurado **bloqueado com CNPJ** (decisão do usuário, 17/08/2026) — o robô só cota Pessoa Física | `cotacaoSegurado.schema.ts` |

## Puxados dos riscos condicionais — documentados, sem implementação

| Task | Descrição | Estado |
|---|---|---|
| R.11 | `nomeHierarquico` nunca é enviado ao robô | 🟡 Investigado, sem candidato claro no domínio do CoteCerto — comentário em `quiver.functions.ts` perto de `montarPayloadQuiver`. Decisão de produto pendente: o que esse campo deveria representar? |
| R.12 | Separar produtos "HDI Fit" / "HDI Básico" no lugar do "HDI" genérico | 🟡 Documentado em `quiver.functions.ts` perto de `SEGURADORA_QUIVER`. Decisão de produto pendente: oferecer as duas variantes na tela? |

## Estado

- **17/08/2026 — frente concluída.** As 4 ondas (R.1–R.10) foram implementadas, revisadas e mergeadas na `main`: [#176](https://github.com/DiegoGervasioAllcom/cotecerto33/pull/176), [#177](https://github.com/DiegoGervasioAllcom/cotecerto33/pull/177), [#178](https://github.com/DiegoGervasioAllcom/cotecerto33/pull/178), [#179](https://github.com/DiegoGervasioAllcom/cotecerto33/pull/179). Branches das 4 ondas apagadas local e remotamente após o merge.
- **Pendências reais** (não são bugs, são decisões de produto em aberto): R.11 e R.12. Nenhuma outra task do plano original segue aberta.
- Fora de escopo desta frente, ainda por tratar depois: `doc/TASK-webhook-resultado-transmissao.md`.
