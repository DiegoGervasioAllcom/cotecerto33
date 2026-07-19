# Q3 — Varredura UI/UX real × protótipo v10

**19/07/2026** · Comparação tela-a-tela das rotas reais contra `cotecerto_prototipo_v10.html` (655 KB), cobertura ampla das 6 personas. Os itens **cosméticos** foram aplicados no PR do Q3; os **estruturais** abaixo são backlog de produto (cada um exige decisão/escopo — não são regressões, e sim funcionalidades do protótipo que a implementação atual simplificou ou reorganizou).

## Legenda
- **[EST]** divergência estrutural (novo componente/lógica/reorganização) — decisão do usuário.
- **[EST-ok]** divergência estrutural **intencional/esperada** (evolução do V10 ou correção de regra de negócio) — nada a fazer.

---

## Telas de venda (venLike)

### `inicio.tsx` (page-home)
- **[EST]** Falta o card **"O que fazer agora (com retorno)"** (`card-yellow` com ações de alto impacto: cotações expirando, propostas sem resposta, leads parados com valor de retorno estimado). O real tem um "Leads parados" mais simples.
- **[EST]** Faltam os `coach-tip` (dica textual do ponto fraco do funil e da posição) — exige lógica para achar a etapa de menor conversão.
- **[EST]** Falta a celebração "🎉 Missão do dia concluída!" quando todas as missões são batidas.

### `venda/pipeline.tsx` (page-pipeline) — **maior gap do bloco venda**
- **[EST]** Sem alternância **Kanban/Tabela**.
- **[EST]** Sem barra de filtros (período, origem, seguradora, status, motivo de perda).
- **[EST]** Cards do Kanban não mostram veículo, badge de idade, próxima ação, timer de retorno da Matriz, chip de motivo de perda; colunas sem valor total; cabeçalho sem contagem/valor estimado.

### `venda/propostas.tsx` (page-proposal) — **gap grande**
- **[EST]** Falta a tela de detalhe **"Negociação · {cliente}"**: ajuste de cobertura, forma de pagamento, parcelamento, nota de versão, **histórico de versões** e "Enviar nova versão ao cliente". O real é uma tabela read-only.
- **[EST]** Modelo de status difere (proto: Aguardando/Em negociação/Aceita/Recusada; real: Gerada/Transmitida/Cancelada) — decisão de dado/produto.
- **[EST]** Sem métricas de cabeçalho (contagem/valor/ticket) nem barra de filtros; falta coluna Veículo.

### `venda/aceite.tsx` (page-aceite) — **gap grande**
- **[EST]** Falta a **timeline do aceite** (Enviada → Visualizada → Aceita → Transmitida → Emitida).
- **[EST]** Falta o **card de conferência final** com checkbox obrigatório "Conferi todos os dados" antes de transmitir.
- **[EST]** Falta o fluxo de **pendência da seguradora** (chip + "Resolver pendência").

### `venda/extrato.tsx` (page-extrato) — **gap grande**
- **[EST]** Falta o bloco de **KPIs** (qtd, R$ vendido, comissão bruta, estornos, líquido, meta com barra).
- **[EST]** Falta a seção de **estornos do mês** e o rodapé com **campanha ativa** + **próximos pagamentos**.
- **[EST]** Barra de filtros incompleta (real só De/Até).

### `venda/mensagens-prontas.tsx` (page-msgs) — **maior divergência de todas**
- **[EST]** Perdeu a experiência de **biblioteca navegável**: barra de categorias, busca, cards em grid, chip "Oficial", corpo com variáveis preenchidas do cliente, botões **Copiar** + **WhatsApp** (`wa.me`). Virou um CRUD simples de mensagens.
- **[EST]** Modelo de dados sem cadência por dia (Dia 1/2/...) com objetivo/etapa.

### Fiéis (venda)
- `venda/atender.tsx`, `venda/cotacoes.*` — fiéis (só cosméticos, aplicados).

---

## Telas de gestão (Matriz / grupo)

### `comando/visao-geral.tsx` (page-mdash / page-xdash)
- **[EST]** No modo **grupo** (`isGroupView`), reaproveita o grid de 9 KPIs da Matriz em vez do conjunto do `xdash` (que tem "Minha comissão" com breakdown operação própria + override de rede, "Prêmio total", "Estornos"; e **não** mostra "Evolução mensal" nem "Ranking de franquias"). Para fidelidade estrita, criar um branch de KPIs/cards dedicado a `isGroupView`.

### `operacao/vendas.tsx` (page-mvendas)
- **[EST]** A aba **"Transmissão"** reusa a tabela genérica de 13 colunas em vez da tabela dedicada do proto (Proposta/Seguradora/Segurado/Vendedor/Franquia/Prêmio/Enviado/Status/**Pendência-prazo**/**Ação "Resolver"**). Falta a coluna de pendência e o botão de resolução.

### `operacao/aprovacoes.tsx` (page-maprov)
- **[EST]** O proto tem um **toggle "Pedidos de desconto / Respostas padrão"** dentro de Aprovações. No real, a gestão de respostas-padrão foi movida para Acessos (`respostas-padrao-panel.tsx`) — reorganização do Q2/G3. Confirmar se é intencional; se sim, nada a fazer.

### `operacao/comissoes.tsx` (page-mcomm) — **atenção**
- **[EST]** O audit-note afirma "Toda alteração de comissão fica registrada com autor, data e valor anterior", mas o card **"Histórico de alterações"** (trilha de auditoria autor/data/valor) do proto foi substituído por um "Resumo do fechamento" estatístico. Verificar se a trilha existe no banco (G4) e expô-la, ou ajustar o texto do audit-note para não prometer o que a UI não mostra.
- **[EST]** Sem o bloco "Sua comissão como Master/Supervisor" (`isGroupView`) — confirmar com o mapa de perfis/G4 se é pendência.

### `operacao/vendedores.$id.tsx` (page-mvend)
- **[EST]** Falta o card de alerta **"Vendedor travado…"** (`card-yellow` quando `status==='travado'`) com dica de revisar carga de leads.

### `operacao/supervisao.tsx` (page-msuperv)
- **[EST]** Falta o bloco final **`.coach-tip`** ("Maior perda: X. É aqui que o time mais deixa venda na mesa…").

### `app-shell.tsx` (navegação global)
- **[EST]** Falta a **busca global** na topbar (proto tem input "Buscar cliente, placa, nº de cotação…"). Hoje é ausência total — implementar (mesmo decorativa) ou remover do backlog. **Nota:** o item de menu "Aprovações" **existe** (o auditor errou); só falta o **badge de contagem**.

### `operacao/acessos.tsx` → aba Desligamentos
- **[EST]** `desligamentos-tab.tsx` tem menos que o proto: faltam colunas **Franquia** e **"Desligado por"** (auditoria de quem desligou), cabeçalho com chip de contagem, estado vazio ilustrado e o `audit-note` de **"Reinclusão controlada"** (regra de negócio confirmada).

### `operacao/mensagens.tsx` (page-mmsgs)
- **[EST/cosmético aplicado]** Não usava as classes do design system (`summary-chips`/`sum-chip`, `audit-note`, `btn-yellow`, `row-actions ic-mini`) — corrigido no PR do Q3 (era o mais destoante visualmente).

### `operacao/xacessos.tsx` (page-xacessos)
- **[EST-ok]** Reformulação consciente ("cadastrar vendedor" → "visão de equipe/rede"). Porém a ação **"Desligar vendedor"** do proto não aparece nesta tela — confirmar se foi movida (ex.: Acessos da Matriz) ou ficou sem cobertura.

### Fiéis / evoluções esperadas
- `comando/leads.tsx`, `comando/distribuicao.tsx`, `operacao/pipeline-geral.tsx`, `operacao/estornos.tsx`, `operacao/franquias.*`, `operacao/vendedores.index.tsx`, `operacao/configuracoes.tsx` — fiéis (cosméticos aplicados).
- `operacao/renovacoes.tsx` — **[EST-ok]** texto do gatilho corrigido (distribuição padrão, não vendedor original — regra G6); botão "Iniciar renovação" adicionado.
- `operacao/premiacoes.tsx`, `operacao/relatorios.tsx` — **[EST-ok]** telas novas do V10 (G5 / Relatórios), mais completas que o mock.
- `operacao/perdas.tsx` — sem espelho no protótipo (lá é modal no pipeline).

---

## Recomendação de priorização (backlog estrutural)
Se houver uma frente pós-V10 de "fidelidade ao protótipo", sugiro esta ordem por impacto no vendedor:
1. `venda/mensagens-prontas` (biblioteca com WhatsApp) — alto valor comercial.
2. `venda/pipeline` (kanban rico + filtros + toggle tabela).
3. `venda/aceite` (timeline + conferência final) e `venda/propostas` (negociação/versões).
4. `venda/extrato` (KPIs + estornos + pagamentos).
5. `comissoes` (trilha de auditoria — ou ajustar o texto que a promete).
6. `visao-geral` modo grupo (KPIs do xdash) e `vendas` aba Transmissão (ação Resolver).
7. Insights: `inicio` (card de ações), `supervisao`/`vendedores` (coach-tip / alerta travado).
