# Perguntas de produto em aberto — para a Lis

**Atualizado em:** 03/08/2026 — itens 2, 3, 4, 5, 6 e 7 respondidos pela Lis. Item 1
segue pendente (o arquivo existe, mas não foi enviado ainda por falha no pacote — a
Lis vai anexar). Junto das respostas, 4 arquivos a caminho: respostas detalhadas,
"Regras Decididas", protótipo **r41** (já traz 2 e 3 corrigidos) e Handoff atualizado
(item 11 resolvido).

As decisões que a engenharia não deve tomar sozinha. Estavam espalhadas entre
`ANALISE_LACUNAS_V11.md` e `PLANO_TASKS_V11.md`; ficam reunidas aqui para nenhuma se
perder. Cada linha diz **o que trava**, **por que não decidimos internamente** e **o custo
de cada saída** — para a conversa ser curta.

## 1. Documento "Regras Decididas" não veio no pacote

⏳ **Ainda pendente em 03/08/2026.** O arquivo existe e a Lis vai anexar — ficou fora
do pacote original por falha no envio. Continua sem bloquear nada que já foi entregue
(Frente 4 e os presets de cargo usaram o `const MENUS` dos Fluxos como fonte
alternativa); só volta a travar se o conteúdo, quando chegar, contradisser algo já
implementado.

**Trava:** a régua de performance (Frente 4) e os escopos dos presets de cargo.

O Relatório DE/PARA e o Handoff citam esse documento como o "porquê" das regras, e ele é
referência de 5 linhas do relatório (regras 3, 4, 5, 6, 7 e 12). Não está no pacote.

A régua (regra 12) e os escopos (regra 5) dependem dele para implementar sem adivinhar. Os
escopos foram extraídos do `const MENUS` dos Fluxos, que é fonte da verdade — mas se as
Regras Decididas contradisserem, a Frente 0 volta.

**Pedido:** o arquivo.

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
