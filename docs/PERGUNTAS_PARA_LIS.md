# Perguntas de produto em aberto — para a Lis

**Atualizado em:** 04/08/2026 — todos os 7 itens resolvidos. O item 1 (documento
"Regras Decididas") chegou em 04/08/2026 junto do protótipo **r41**, do Handoff
atualizado e das Respostas de Produto/TI — destravou a Frente 5b (ver
`docs/PLANO_FRANQUIA_FULL_V11.md`).

As decisões que a engenharia não deve tomar sozinha. Estavam espalhadas entre
`ANALISE_LACUNAS_V11.md` e `PLANO_TASKS_V11.md`; ficam reunidas aqui para nenhuma se
perder. Cada linha diz **o que trava**, **por que não decidimos internamente** e **o custo
de cada saída** — para a conversa ser curta.

## 1. Documento "Regras Decididas" não veio no pacote

✅ **Resolvido em 04/08/2026.** O arquivo (`CoteCerto_Regras_Decididas.html`, datado de
27/07) chegou junto do protótipo r41, do Handoff atualizado e das Respostas de Produto/TI
— não contradisse nada já implementado com o `const MENUS` dos Fluxos como fonte
alternativa. Foi o gatilho que destravou a Frente 5b (Central da Franquia/
Personalização/Performance/Histórico da Full) — ver `docs/PLANO_FRANQUIA_FULL_V11.md`.

> Nota de rastreabilidade: o arquivo foi recebido como anexo de chat, não commitado em
> `docs/` — `supabase/seed.sql` cita o caminho `docs/CoteCerto_Regras_Decididas.html`
> num comentário (regra 2, diretores), mas esse caminho não existe no repositório. Se
> for preciso auditar a regra depois, o arquivo original está fora do controle de versão.

## 2. Endereço único das configurações da Franquia Full

✅ **Resolvido em 03/08/2026 — destrava a Frente 5.** Endereço definitivo: **Acessos e
permissões › Personalização/Performance**. A Central da Franquia fica só com a
operação de leads. Já corrigido no protótipo r41 (a caminho).

## 3. Estornos para o Supervisor de Vendas

✅ **Resolvido em 03/08/2026.** O r40 tinha esquecido mesmo: o Supervisor de Vendas
ganha Estornos (**11 áreas**). Aplicar a linha na migration (`cargo_areas`) e virar o
teste que hoje documenta a divergência (esperava 10, sem Estornos) para 11, com
Estornos. r41 já traz corrigido.

## 4. Carteira de Recuperação

✅ **Resolvido em 03/08/2026.** Fica para a **V12**. Prioridade agora é o teste com o
canal Movida.

## 5. Quem aprova o vendedor de Franquia Full — hoje e depois

✅ **Resolvido em 03/08/2026.** Fica como está: a Full aprova sozinha, sem mudança de
código. Se a operação real pedir uma das 3 saídas (override/fallback/escalonamento),
revisitamos na V12 — `fn_destino_pedido`/`fn_pode_aprovar_pedido` continuam separadas
de propósito para essa mudança ser local quando/se vier.

## 6. Escopo de dados do time de apoio (Assistente Comercial e Marketing)

✅ **Resolvido em 03/08/2026.** Marketing e Assistente Comercial enxergam **só a
operação da Matriz** (leitura), **sem** os dados das franquias Full. Ainda precisa de
implementação: separar leitura de escrita nas policies de SELECT afetadas (mudança
larga, ~22 policies, mapeadas em `docs/ANALISE_LACUNAS_V11.md`) — candidato a task
própria, fora da Frente 5.

## 7. Remetente dos e-mails de acesso

✅ **Resolvido em 30/07/2026.**

O remetente será `acesso@cote-certo.sandboxallcom.com`, com respostas direcionadas
para `diego.gervasio@allcomtelecom.com`. O domínio está verificado no Resend e os
registros DKIM, SPF e DMARC (`p=none`) foram publicados no Cloudflare.
