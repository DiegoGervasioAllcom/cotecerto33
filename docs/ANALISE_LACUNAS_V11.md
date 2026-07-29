# Análise de Lacunas — CoteCerto V11

**Corte:** 28/07/2026

**Base de comparação:** `main` em `23f7a4d` (V10 fechada para go-live), 83 migrations
canônicas, protótipo `cotecerto_prototipo_v10.html`.

**Pacote V11 recebido (fechado para o TI em 28/07/2026):**

| Arquivo                                  | Papel                                                           |
| ---------------------------------------- | --------------------------------------------------------------- |
| `cotecerto_prototipo_v11.html`           | Protótipo funcional, build **28/07 · r40** — referência de UX    |
| `docs/v11/RELATORIO_DEPARA_V10_V11.html` | O que mudou, etapa por etapa, e onde ver no protótipo            |
| `docs/v11/HANDOFF_PRODUCAO_V11.html`     | 11 itens que o protótipo simula e precisam virar implementação   |
| `docs/v11/FLUXOS_OPERACIONAIS.html`      | **Fonte da verdade das regras** — 5 fluxos navegáveis            |
| `docs/v11/MODELOS_EMAIL_ACESSO.html`     | Corpo dos e-mails de acesso                                      |

## Resumo executivo

A V11 não é um incremento de telas sobre a V10 — ela **redesenha o organograma e a
porta de entrada do sistema**. Três mudanças arrastam quase todo o resto:

1. **A hierarquia ganhou dois níveis novos.** Entra o Coordenador Comercial (entre a
   Matriz e a rede) e o segundo supervisor (Vendas × Operacional). O Master passa a
   responder ao Coordenador, não à Matriz. O `perfil` atual (`matriz`, `master`,
   `supervisor`, `vendedor`, `franqueado`) não expressa isso.
2. **Todo cadastro passa a nascer de um convite nominal de uso único.** O autocadastro
   espontâneo — que é o que está implementado hoje em `auth.cadastro.tsx` — é
   **removido**. Criação direta pela Matriz vira exceção com log.
3. **Regra só muda com diretor autenticado e rastro DE/PARA imutável.** "Diretor" é uma
   marcação no cadastro (mínimo 2, não é cargo do organograma), e nenhuma política grava
   sem senha de diretor + linha no histórico append-only. Nada disso existe no código.

O impacto é maior do que o Relatório DE/PARA sugere, por um motivo concreto: **a coluna
"DE (V10)" descreve um estado de design intermediário, não o que está em produção.**
Ver "Divergências entre as fontes" abaixo.

## Mudança estrutural — hierarquia V10 → V11

| Nível         | V10 (implementado)                           | V11 (protótipo r40 + Fluxos)                                                   |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| Topo          | Matriz                                       | Matriz — com **marcação de diretor** (mín. 2) sobre o cadastro                  |
| Gestão        | `supervisor` genérico                        | **Coordenador Comercial** → Supervisor de **Vendas** e Supervisor **Operacional** |
| Apoio         | —                                            | Assistente Comercial, Marketing (+ Financeiro/Compras/Facilities "em breve")    |
| Rede interna  | `vendedor` (CLT), Franquia Individual        | igual, sob o Supervisor de Vendas                                               |
| Rede externa  | `master` → franquias/vendedores              | Master **sob o Coordenador**; Vendedor·Master, Individual (5 classificações), Full |
| Franquia Full | bifurcação Individual/Full com gate por grupo| **"Matrizinha"**: Central própria, 5 abas de acessos, régua e histórico próprios |

Alçada de desconto muda de dono: passa a ser exclusiva do **Supervisor de Vendas**, e a
cadeia de escalonamento externo ganha o salto Master → Coordenador → Matriz.

## Lacunas por etapa

Legenda de esforço: **P** (dentro de uma task), **M** (frente), **G** (frente com banco + front + testes).

### Etapa 1 · Autocadastro + Convite Supper — aprovada 27/07

| O que a V11 exige                                                       | Estado no código                                                     | Esforço |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- | ------- |
| Tabela de convites (token nominal, uso único, validade, perfil+vínculo)  | **não existe** — nenhuma tabela `convite`                            | G       |
| Rota `/convite/{código}` abrindo cadastro pré-preenchido e travado       | **não existe**                                                        | M       |
| Remover cadastro espontâneo                                              | `src/routes/auth.cadastro.tsx` (435 linhas) é exatamente ele          | M       |
| Botão "Quero falar com a Cote Certo" (e-mail à Matriz, sem persistência) | **não existe**                                                        | P       |
| Botão Convidar em 4 escopos (Matriz interno/externo, Master, Full)       | **não existe**                                                        | M       |
| Saídas do convite: WhatsApp (wa.me), Copiar, **PDF com arte oficial**    | **não existe**                                                        | M       |
| 7 cargos + Vendedor Matriz, com áreas de escopo                          | **não existe conceito de cargo** — nem tabela, nem UI (ver divergência) | G     |
| Pedido em Pendentes com tipo declarado, vínculo e origem                 | `PendentesTab` existe, mas sem tipo declarado nem origem             | M       |

### Etapa 2 · Duas filas de aprovação — aprovada 27/07

| O que a V11 exige                                                        | Estado no código                                                           | Esforço |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------- |
| Pendentes em dois blocos (interno × rede)                                 | fila única em `acessos.tsx`                                                | M       |
| Vendedor de Full cai na fila **da própria franquia**                      | **não existe** roteamento de fila por vínculo                              | M       |
| Modal de análise travado no que o convite definiu ("Reclassificar" = exceção) | `classificar-acesso-modal.tsx` abre com escolha manual                | M       |
| Seletor de Supervisor de Vendas na aprovação de Master                    | **não existe**                                                              | P       |
| **Canais de leads** escolhidos na aprovação, com botão "Todos"            | **não existe taxonomia de canais** — nenhuma tabela                        | G       |
| Aba **Cadastros Matriz** unificada (colaboradores + Vendedores Matriz)    | hoje: aba própria de vendedores (`solicitacoes-vendedor-tab.tsx`)          | M       |
| Aba **Cadastros Rede** nova (Masters, franquias com modelo, vendedores)   | **não existe**                                                              | M       |
| "Cadastro manual · exceção" com selo amarelo e log                        | `cadastrar-vendedor-form.tsx` cadastra direto, sem selo nem log            | M       |
| **Régua de performance** (OK/Atenção/Travado, 2 réguas independentes)     | **não existe** — nem tabela, nem job, nem selo                             | G       |
| Travado sai da distribuição automática                                    | distribuição existe (`20240101000028_*`) mas não conhece performance      | M       |

### Etapas 3 a 7 + refinamentos — fechadas 28/07 · build r40

| O que a V11 exige                                                       | Estado no código                                                       | Esforço |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------- |
| 3 e-mails de acesso (boas-vindas com escopo, pendência, recusa)          | **não existe** envio de e-mail transacional                            | M       |
| Tela **Criar senha** (link 48h, uso único)                               | **não existe**                                                          | M       |
| Master convida e **acompanha** ("Meus cadastrados"), solicita desligamento | Master hoje cadastra e desliga direto                                | M       |
| Full como matrizinha completa (Central própria, 5 abas, régua, histórico) | Full hoje tem gate por grupo, sem Central nem acessos próprios       | G       |
| Governança: mín. 2 diretores, senha de diretor em 9 botões "Salvar política" | **não existe** conceito de diretor                                 | G       |
| **Histórico imutável com DE/PARA**, filtro por área, persistente         | **não existe** nenhuma tabela de histórico                             | G       |
| Motivo obrigatório em todo desligamento, com "Detalhes"                  | coluna `desligado_motivo` existe mas é opcional (renderiza `—` quando nula) | P  |
| Produtos padrão por bloco (interno: todos · externo: só Auto), herdados  | **não existe**                                                          | M       |
| **Período único** (dia/semana/quinzena/mês/personalizado) server-side    | `visao-geral.tsx` tem 4 opções mensais, calculadas no cliente          | M       |
| 4 funis por canal (Movida/Google/Facebook/Manual) + alertas clicáveis     | dashboard atual não tem funil por canal                                | M       |

### Itens do Handoff de Produção (o que o protótipo não entrega)

Os 11 itens do `HANDOFF_PRODUCAO_V11.html` já estão distribuídos nas etapas acima, com
duas exceções que são **infra, não tela**:

- **Item 4 · WhatsApp Business API** — o wa.me do protótipo é paliativo; o anexo do PDF é
  manual. Automatizar exige conta e aprovação de template. É a única dependência externa
  do pacote e deve entrar como frente própria, fora do caminho crítico.
- **Item 7 · Histórico append-only por permissão de banco** — não basta a tabela: a
  aplicação não pode ter `UPDATE`/`DELETE`. Isso é grant, não policy, e conversa direto
  com a regra 3 do `AGENTS.md`.
- **Item 10 · Persistência geral** — na demo só o histórico persiste no navegador. Filas,
  cadastros, solicitações e motivos precisam de banco.

## Lacuna encontrada no teste das 12 personas (29/07/2026)

**Dois dos 7 cargos não têm `perfil` correto onde morar.** A V11 acrescentou só
`coordenador` ao enum `public.perfil`, que agora é `matriz`, `coordenador`, `supervisor`,
`master`, `franqueado`, `vendedor`. Direção → `matriz`, Coordenador → `coordenador` e os
três supervisores → `supervisor` encaixam. Mas **Assistente Comercial** e **Marketing**
não são supervisores nem Matriz: hoje só rodam marcados como `supervisor`, o que acerta o
menu (o recorte vem do cargo) e erra duas coisas:

- **O selo.** A tela mostra "SUPPER · SUPERVISOR" para quem é Assistente ou Marketing.
- **O escopo de dados.** `perfil` é o que a RLS lê. Um `supervisor` sem subordinados vê,
  por `empresas_visiveis()`, só a própria empresa — mas Marketing tem Leads, Distribuição
  e Relatórios no menu justamente para olhar a captação inteira. Ou seja, o menu abre
  telas que o dado não preenche.

No protótipo o problema não aparece porque lá o menu vem *só* do cargo — não existe eixo
de perfil. Aqui os dois eixos coexistem (perfil = segurança, cargo = escopo de tela) e
falta um valor para "time interno de apoio".

Duas saídas, ambas de banco: somar um valor `interno` ao enum, ou passar o escopo de dados
a depender de área em vez de perfil (o que casaria com o resto da V11, já que
`fn_tem_area` existe). **Precisa de decisão antes de convidar Assistente ou Marketing pela
Frente 1** — o convite grava perfil.

## Divergências entre as fontes

Três pontos precisam de decisão antes de virar task. Nenhum bloqueia começar a Etapa 1.

1. **A coluna "DE (V10)" do Relatório DE/PARA não descreve a V10 entregue.** O relatório
   diz que a V10 tinha "cargos presets: 9, com legado". O protótipo V10 não menciona
   cargo nenhuma vez (`grep -c "cargo" cotecerto_prototipo_v10.html` → 0) e o código não
   tem tabela nem tela de cargo. Efeito prático: **cargos e áreas de escopo são frente
   nova completa**, não ajuste de uma lista existente. Vale revisar se outras linhas "DE"
   descrevem design intermediário em vez do que está em produção.
2. **A "Carteira de Recuperação" está nos Fluxos mas não no protótipo r40.** O fluxo de
   distribuição de leads define dois destinos para a perda — Carteira de Recuperação
   (segunda lista dentro da Central, com motivo e data, para retrabalho manual) ou
   exclusão definitiva — e o espelho disso na Full. O r40 não tem essa tela. Como os
   Fluxos são a fonte da verdade das regras, ou a tela entra na V11 sem referência visual,
   ou a regra fica para a V12. **Precisa de decisão.**
3. **"Regras Decididas" não veio no pacote.** O DE/PARA e o Handoff citam esse documento
   como o "porquê" das regras, e ele é referência de 5 linhas do relatório (regras 3, 4,
   5, 6, 7 e 12). Não está no Downloads nem no repositório. A régua de performance
   (regra 12) e os escopos dos presets (regra 5) dependem dele para implementar sem
   adivinhar. **Pedir à Lis.**

Além disso, o próprio Handoff registra uma pendência de produto em aberto:

4. **Item 11 do Handoff — endereço único das configurações da Franquia Full.** Hoje o
   protótipo tem dois caminhos (Central da Franquia × Acessos › Personalização). Decisão
   da Lis, e ela precisa vir antes da tela final da Full.

## Onde a V11 se apoia no que já existe

Não é tudo greenfield. A V11 reaproveita:

- **RLS por escopo** (`empresas_visiveis()`, `has_role()`) e a correção de escopo de rede
  do Master (`20260721150000_s_fix_master_rls_escopo_rede.sql`) — a base de visibilidade
  serve aos perfis novos, faltando estender o enum e a cadeia de `superior_id`.
- **Cadeia hierárquica** (`superior_id`, de `20260716201626_g1_1_*`) — é o gancho natural
  para Coordenador e para os dois supervisores.
- **Escalonamento de desconto multinível** (G3) — a cadeia já é recursiva por `superior_id`;
  a mudança é de topologia (quem tem alçada), não de motor.
- **Distribuição de leads** (`20240101000028_*`) — precisa passar a respeitar canais
  habilitados e o sinal Travado, mas o distribuidor existe.
- **`proto.css` byte a byte** — o CSS do protótipo V11 deve ser diffado contra o atual
  antes de qualquer tela (regra 6 do `AGENTS.md`).

## Risco principal

A Etapa 1 derruba a porta de entrada atual. Enquanto o convite não estiver de pé,
**não há caminho de cadastro no sistema** — o autocadastro sai e nada entra no lugar.
Sequenciar convite → cadastro por link → filas antes de remover `auth.cadastro.tsx`,
e manter a criação direta pela Matriz funcionando como exceção durante a transição.
