# Plano — Corrigir divergências Formulário × Robô Quiver

Base: `doc/REVISAO-FORM-VS-CONTRATO-ROBO-2026-08.md` (revisão de 16-17/08/2026).
Fora de escopo aqui: `doc/TASK-webhook-resultado-transmissao.md` (fica para depois).

Fluxo por onda: planejador → front/testes → revisor (AGENTS.md).

## Onda 1 — Correções isoladas, baixo risco (em andamento)

| Task | Descrição | Arquivo |
|---|---|---|
| R.1 | RCF vazio: trocar `?? undefined` por checagem explícita de string vazia → `undefined` | `quiver.functions.ts:306-307` |
| R.2 | Remover máscara `R$` residual nos 11 campos monetários que ainda vazam | `quiver.functions.ts:199,205,213,222` |
| R.3 | Seguradoras não suportadas pelo robô: **removidas da lista de seleção** (decisão do usuário, 17/08/2026) — não oferecer a opção em vez de descartar em silêncio depois | `quiver.functions.ts:70-74,160` + tela de seleção de seguradoras |
| R.4 | `premioNumerico()`: aplicar o mesmo fallback do PR #175 (extrair de `parcelas` quando `avista` ausente) | `quiver-resultado.ts:78-85` |

## Onda 2 — Correções de UI com impacto direto no formulário

| Task | Descrição | Arquivo |
|---|---|---|
| R.5 | Corrigir enum `cobertura.plano` (`Personalizada` → `personalizado`) e isolar o segundo select de `StepSeguro.tsx` para não sobrescrever o mesmo estado do primeiro | `enumsCoberturas.ts:9`, `StepSeguro.tsx:110-126` |
| R.6 | Adicionar opção vazia real nos selects de RCF para não parecer preenchido quando não está | `StepCoberturas.tsx:104-121` |
| R.7 | Corrigir valores órfãos: zerar/remover `acessorios_detalhes` e `antifurto_detalhes` quando o toggle correspondente vira "não" | `AcessoriosFold.tsx:152`, `quiver.functions.ts:169,222` |

## Onda 3 — Fluxo de Renovação (maior gap)

| Task | Descrição | Arquivo |
|---|---|---|
| R.8 | Implementar envio do bloco "apólice anterior" (7 campos) em `montarPayloadQuiver` quando `seguro.tipo = Renovação` | `quiver.functions.ts:158-161` |

## Onda 4 — Gate de cálculo e CPF/CNPJ

| Task | Descrição | Arquivo |
|---|---|---|
| R.9 | Reescrever `podeCalcular` para exigir os campos reais do robô (placa, email, cep, telefone, cepPernoite, cepCirculacao, kmMes) e não os que ele ignora (marca/modelo/ano) | `useSimulacaoCalculo.ts:127-134` |
| R.10 | CPF/CNPJ: **bloquear PJ na tela** (decisão do usuário, 17/08/2026) — validação impede avançar com CNPJ, com mensagem explicando que o robô só cota PF | `StepSegurado.tsx:30` |

## Puxados dos riscos condicionais (baratos, resolvem junto)

| Task | Descrição |
|---|---|
| R.11 | `nomeHierarquico` — parar de depender de env vazia; enviar valor real do front |
| R.12 | Separar produtos "HDI Fit" / "HDI Básico" no lugar do "HDI" genérico |

## Estado

- **17/08/2026**: plano aprovado pelo usuário; decisões de R.3 e R.10 registradas acima. Onda 1 iniciada.
