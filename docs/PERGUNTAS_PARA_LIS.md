# Perguntas de produto em aberto — para a Lis

**Atualizado em:** 30/07/2026

As decisões que a engenharia não deve tomar sozinha. Estavam espalhadas entre
`ANALISE_LACUNAS_V11.md` e `PLANO_TASKS_V11.md`; ficam reunidas aqui para nenhuma se
perder. Cada linha diz **o que trava**, **por que não decidimos internamente** e **o custo
de cada saída** — para a conversa ser curta.

## 1. Documento "Regras Decididas" não veio no pacote

**Trava:** a régua de performance (Frente 4) e os escopos dos presets de cargo.

O Relatório DE/PARA e o Handoff citam esse documento como o "porquê" das regras, e ele é
referência de 5 linhas do relatório (regras 3, 4, 5, 6, 7 e 12). Não está no pacote.

A régua (regra 12) e os escopos (regra 5) dependem dele para implementar sem adivinhar. Os
escopos foram extraídos do `const MENUS` dos Fluxos, que é fonte da verdade — mas se as
Regras Decididas contradisserem, a Frente 0 volta.

**Pedido:** o arquivo.

## 2. Endereço único das configurações da Franquia Full

**Trava:** as telas finais da Frente 5 (V11.5.2 e V11.5.4).

É o **item 11 do próprio Handoff**, já registrado lá como "decisão de produto pendente
(Lis)". Hoje o protótipo tem dois caminhos: Central da Franquia × Acessos › Personalização.

**Pergunta:** qual dos dois é o endereço definitivo?

## 3. Estornos para o Supervisor de Vendas

**Trava:** nada — está implementado seguindo o r40. Mas é divergência entre fontes.

O protótipo r40 dá **10 áreas** ao cargo Supervisor de Vendas e **não** inclui Estornos. O
`const MENUS` dos Fluxos dá **11**, com Estornos.

Seguimos o r40 (é a referência que o QA compara), com o teste apontando a divergência. Mas
a estrutura sugere que o r40 esqueceu: a lista dos Fluxos é exatamente *"o menu do Master
sem Acessos"*, uma derivação limpa que o r40 quebra sem justificativa na descrição do cargo.
E o Master e a Franquia Full têm Estornos — o Supervisor de Vendas seria o único papel de
supervisão comercial sem ver a comissão voltando.

**Custo de mudar:** uma linha de `insert` na migration e um assert no teste.

## 4. Carteira de Recuperação

**Trava:** nada hoje; decide se entra na V11 ou fica para a V12.

O fluxo de distribuição de leads define dois destinos para a perda — Carteira de Recuperação
(segunda lista dentro da Central, com motivo e data, para retrabalho manual) ou exclusão
definitiva — e o espelho disso na Franquia Full. **O protótipo r40 não tem essa tela.**

Como os Fluxos são a fonte da verdade das regras, ou a tela entra na V11 sem referência
visual, ou a regra fica para a V12.

**Pergunta:** V11 sem protótipo, ou V12?

## 5. Quem aprova o vendedor de Franquia Full — hoje e depois

**Trava:** nada. Implementado como o r40 manda; a pergunta é sobre o futuro.

**Como está:** o pedido de um vendedor de Franquia Full **não entra na fila da Matriz** —
cai na fila da própria franquia, que aprova sozinha. Os Fluxos dizem isso duas vezes ("o
pedido não vai para a Matriz", "aprova sem depender da Matriz") e o protótipo filtra o caso
antes de montar as filas da Matriz. A Matriz continua vendo os vendedores das Fulls em
**Cadastros Rede**, depois de aprovados — o que ela não tem é o poder de aprovar.

**A pergunta:** mais adiante a Matriz deve poder aprovar também? E se sim, em que forma?

| Saída | O que significa | Custo |
| --- | --- | --- |
| **Override** | a Matriz sempre pode aprovar, em paralelo à Full | 1 linha em `fn_pode_aprovar_pedido` + inverter um teste. Custo real não é técnico: a autonomia da Full deixa de ser garantia e passa a ser convenção |
| **Fallback** | a Matriz só assume se a Full não agir em N dias | precisa de prazo, job periódico e regra de "abandonado"; conversa com a régua de performance (Frente 4) |
| **Escalonamento** | a Full pede à Matriz, com motivo e rastro | trabalho médio, e é o padrão que a V11 já usa noutros lugares (o Master *pede* desligamento à Matriz em vez de fazer) |

**Nota de engenharia:** o código já foi escrito com essa costura pronta —
`fn_destino_pedido` (de quem é a fila) e `fn_pode_aprovar_pedido` (quem pode aprovar) são
funções separadas de propósito, justamente para essa mudança ser local depois. O comentário
da migration diz qual linha muda em cada cenário.

**Palpite nosso, para provocar a conversa:** escalonamento, por ser o padrão do resto do
documento. Mas é palpite.

## 6. Escopo de dados do time de apoio (Assistente Comercial e Marketing)

**Trava:** nada hoje; mas o menu abre telas que o dado não preenche.

O perfil `interno` existe e o menu sai certo pelo cargo. Só que o escopo de dados é estreito:
Marketing tem Leads, Distribuição e Relatórios no menu justamente para olhar a captação
inteira, e hoje enxerga pouco.

Dar leitura ampla **sem** dar escrita exige separar os dois eixos nas 22 policies de SELECT —
mudança larga. E depende de decidir o que exatamente esses dois cargos devem ver.

**Pergunta:** Marketing e Assistente Comercial enxergam a operação toda (leitura), ou só o
que passa pela empresa deles?

## 7. Remetente dos e-mails de acesso

✅ **Resolvido em 30/07/2026.**

O remetente será `acesso@cote-certo.sandboxallcom.com`, com respostas direcionadas
para `diego.gervasio@allcomtelecom.com`. O domínio está verificado no Resend e os
registros DKIM, SPF e DMARC (`p=none`) foram publicados no Cloudflare.
