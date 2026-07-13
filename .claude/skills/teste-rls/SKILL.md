---
name: teste-rls
description: Escrever testes de RLS/visibilidade por perfil no CoteCerto — clients autenticados por persona contra Supabase local, com casos positivos e negativos. Use após qualquer migration com policy nova e nas tasks T4, G1.7.
---

# Teste de RLS — padrão CoteCerto

## Princípios

- Rodar contra Supabase LOCAL (`supabase start`), nunca produção.
- Um client autenticado POR PERSONA (matriz, master, supervisor, franquia full, franquia individual, vendedor CLT, vendedor de franquia). NUNCA usar service_role nos asserts — ela bypassa RLS.
- Todo teste tem par positivo/negativo: "master VÊ lead da sua franquia" + "master NÃO VÊ lead de outra rede".

## Estrutura

1. **Seed compartilhado** (um só arquivo): cria a árvore mínima da V10 —
   matriz → master (com franquia própria + 1 franquia supervisionada full com 1 vendedor) e matriz → supervisor (com 1 vendedor CLT + 1 franquia individual). IDs fixos e legíveis (`master_a`, `franq_ind_1`...).
2. **Matriz de visibilidade esperada** (tabela no teste, derivada de `docs/MAPA_PROTOTIPO_PERFIS.md` §3–4): para cada tabela sensível (leads, cotações, comissao_lancamentos, desconto_solicitacoes), quem vê o quê.
3. **Asserts de escrita:** inserts/updates proibidos devem FALHAR (ex.: vendedor tentando inserir em `comissao_lancamentos`, franquia individual tentando ler a fila de aprovações).
4. **Views:** testar que views novas respeitam o perfil (efeito do `security_invoker`).
5. **Constraints:** aproveitar o seed para validar D1–D4 (texto gigante, valor negativo, documento duplicado → erro).

## Nomeação

`test('supervisor vê apenas CLT e franquias diretas')` · `test('franquia individual NÃO acessa inbox de aprovações')` — português, descrevendo a regra de negócio.
