# Mapa do Protótipo V10 por Perfil — telas, cliques e campos condicionais

**v1.0 · 13/07/2026** · Revisão profunda de `cotecerto_prototipo_v10.html` (655 KB, 12 blocos de script). Complementa a Análise de Lacunas: aqui está o comportamento exato que o sistema precisa reproduzir, perfil a perfil.

---

## 1. Tela de login — 6 personas, 6 destinos

O login roteia pelo **e-mail digitado** (busca o nome dentro do texto; a senha não é validada — comportamento de protótipo). Além do formulário, há botões de acesso demo (`authDemo`) para cada persona:

| Persona (botão/e-mail) | Perfil interno | Bifurcação | Tela inicial após login |
|---|---|---|---|
| **Ana** · ana@suppercerto.com.br | `matriz` | — | `mdash` (Visão geral da Matriz) |
| **Douglas** · douglas@... | `master` | — | `xdash` (Visão geral do grupo) |
| **Paula** · paula@... | `supervisor` | — | `xdash` (Visão geral do grupo) |
| **Marcelo** · marcelo@... | `franquia` | `setFranqPersona('full')` → Full | `xdash` (Visão geral do grupo) |
| **Felipe** · felipe@... | `franquia` | `setFranqPersona('indiv')` → Individual | `home` (cockpit de vendedor) |
| **Rafinha** · rafinha@... (ou qualquer outro) | `vendedor` | — | `home` (cockpit de vendedor) |

São **5 perfis internos** (`vendedor, matriz, master, supervisor, franquia`) que viram **6 experiências**, porque o perfil `franquia` bifurca:

- `isFranqIndividual()` = franquia com modelo Smart/Conecta/Light/Link/Flex → recebe a experiência **de vendedor** (`venLike`).
- Modelo Full → experiência **de gestão de grupo** (`grpLike`), igual à de Master e Supervisor.

## 2. O que muda na interface ao trocar de perfil (`setProfile`)

| Elemento | Regra |
|---|---|
| Menu lateral | 3 grupos: `nav-vendedor` (venLike), `nav-matriz` (só matriz), `nav-master` (grpLike = master, supervisor, franquia Full) |
| Botão "Novo lead" | só venLike (vendedor e franquia Individual) |
| Selo da marca | SUPPER · MATRIZ / MASTER / SUPERVISOR / FRANQUEADO / CORRETOR |
| Avatar + nome | A·Ana, D·Douglas, P·Paula, M·Marcelo (com "· individual" quando for o caso), R·Rafinha |
| Placeholder da busca | gestão: "Buscar lead, vendedor, apólice…" · venda: "Buscar cliente, placa, nº de cotação..." |
| Badges | `updateAprovBadges()` recalcula o contador de Aprovações para o nível logado |

## 3. Menus e telas por perfil

**Vendedor e Franquia Individual** (9 itens): Início, Atender agora, Pipeline, Novo lead, Cotações, Propostas, Aceite & transmissão, Extrato de vendas, Mensagens prontas.

**Matriz** (17 itens): Visão geral (mdash), Leads, Distribuição, **Aprovações**, Franquias, Vendedores, Supervisão, Pipeline geral, Vendas, Comissões, Premiações, Estornos, Renovações, Relatórios, Mensagens, Acessos e permissões, Configurações.

**Master / Supervisor / Franquia Full** (12 itens): Visão geral (xdash), **Aprovações**, Vendedores, Supervisão, Pipeline geral, Vendas, Comissões, Premiações, Estornos, Renovações, Relatórios, Acessos (xacessos).

As 12 telas do grupo são **as mesmas para os 3 perfis de gestão** — o que muda é o **escopo dos dados**, resolvido por `activeGroup()`:

| Perfil | activeGroup() | Vê | % sobre a equipe (`groupPct`) |
|---|---|---|---|
| Master | `MASTER` | operação própria (`ownFranqId`) + franquias supervisionadas (`franqIds`) | **20%** fixo |
| Supervisor | `SUPERVISOR` | vendedores CLT + franquias diretas da Matriz | **personalizável** (vem de `MODELO_SUPERVISOR.comissaoGrupo`, ex.: 15%) |
| Franquia Full | `FRANQUEADO` | só a própria equipe | **0%** (remunerada pelo modelo de franquia) |

Há ~62 pontos de código condicionais por perfil dentro das telas (`isGroupView` 20×, `profile==='franquia'` 15×, `supervisor` 12×, `isFranqIndividual` 7× etc.) — títulos, colunas e cartões mudam conforme quem olha.

## 4. Aprovações (desconto) — quem vê o quê

`reqInbox()` filtra os pedidos pelo **nível endereçado** (`nivelAtual`):

| Perfil | Vê na fila |
|---|---|
| Matriz | pedidos com nível `matriz` (última instância) |
| Supervisor | nível `supervisor` |
| Master | nível `master` **e** só das franquias da rede dele (`MASTER.franqIds`) |
| Franquia Full | nível `franqueado` **e** só das próprias franquias |
| Vendedor / Franquia Individual | **não veem a fila** — apenas solicitam |

Quem solicita (`currentReqTarget()`): franquia → resolve o superior real (Master ou Supervisor, via `franqSuperiorInfo`); master/supervisor → Matriz. Ações do aprovador: aprovar, contrapropor, negar, **escalar** (+1 nível, preservando a trilha) e **abrir cotação** para conferência (`abrirCotacaoConf` — no protótipo é um resumo; em produção deve ser a cotação real somente leitura).

O botão "**Solicitar desconto adicional à matriz**" aparece na tela de cotação do vendedor/franquia Individual → abre modal (`openDescontoReq` → `submitDescontoReq`).

## 5. Campos ocultos e condicionais (o ponto mais importante)

### Modal "Classificar acesso" (Acessos e permissões da Matriz)

Ao liberar um cadastro pendente, o formulário **muda conforme PJ/PF e o tipo escolhido** — só um ramo existe no DOM por vez (por isso a varredura estática acusa IDs "duplicados"; é falso-positivo, confirmado na Auditoria):

| Cadastro | Tipos oferecidos (pills) | Campos que aparecem |
|---|---|---|
| **PJ** | Franquia · Master franqueado | — |
| **PF** | Vendedor CLT · Vendedor de franquia · Supervisor (Matriz) | — |
| tipo = **franquia** | | Reporta a (`cl_superior` — Master ou Supervisor da Matriz) · Modelo de franquia (`cl_franquia`) · controle de isenção (`toggleIsenta`/`cl_franquia_ctrl`) · leads/dia (`cl_leads`) |
| tipo = **master** | | Supervisão · % sobre a comissão da equipe (`cl_mm_com`, padrão 20%) · Royalties + FPP (`cl_mm_roy`) |
| tipo = **supervisor_matriz** | | Comissão modelo Supervisor (`cl_ms_com`) · Royalties (`cl_ms_roy`) · **Franquias que vai supervisionar** (`cl_ms_franq`) |
| tipo = **vendedor_clt** | | Reporta a Supervisor (`cl_clt_sup`) · Equipe (`cl_equipe`) · Salário base (`cl_salario`) · leads/dia (`cl_leads`) · Bônus de campanha (`cl_bonus`) · Dia de pagamento (`cl_diapg`) · Faixa Elite: acima de R$ (`cl_faixaval`) → comissão passa a % (`cl_faixapct`) |
| tipo = **vendedor_franquia** | | Vínculo com a franquia (modelo Full) |

Ações finais: **Liberar acesso** (`liberarCad`) ou **Recusar** (`recusarCad`).

### Política de alçada (Acessos › Personalização geral)

Cards por modelo de acesso (`descPolicyCard`/`saveDescPolicy`): % máximo de desconto por **7 seguradoras** (`POLICY_SEGS`: Porto, Azul, Itaú, Tokio, HDI, Suhai, Demais) + condições, para Franquia Individual, Franquia Full, Master e Supervisor. Vendedores não têm política (apenas solicitam).

### Outros modais

Classificar perda (motivo → **submotivo carrega destino sugerido**: Remalho ou Descarte), Histórico do lead, Agendamento, e "Usuários do sistema" (lista central em Configurações: usuário, tipo, supervisão, status).

## 6. Tutoriais — 3 roteiros distintos por perfil

O tour com spotlight (`startTour`, alvos `page/target`) escolhe o conteúdo por `curChapters()`:

| Roteiro | Quem recebe | Módulos | Passos | Telas percorridas |
|---|---|---|---:|---|
| `TOUR_CHAPTERS` | Vendedor **e Franquia Individual** | M1 Da chegada ao fechamento · M2 O que você ganha | ~73 | home, atender, pipeline, lead, compare, proposal, aceite, extrato, msgs |
| `MATRIZ_CHAPTERS` | Matriz | M1 Comando · M2 Lead não pode esfriar · M3 Acompanhar/cobrar · M4 Remunerar · M5 Acessos | ~54 | as 17 telas da Matriz |
| `MASTER_CHAPTERS` | Master, Supervisor e Franquia Full | M1 Seu grupo · M2 Equipe · M3 Financeiro · M4 Renovação/Relatórios · M5 Acessos | ~21 | as 12 telas do grupo |

A abertura (`curTourCfg`) é personalizada por persona ("Olá, Ana!", "Olá, Douglas!"...). Total: **~148 passos de tutorial** com ~111 alvos de spotlight.

## 7. Jornada de cliques típica por persona

- **Rafinha (vendedor):** home → Atender agora (assume lead) → Novo lead/cotação → compara seguradoras → *Solicitar desconto adicional* (se precisar) → proposta → aceite → extrato.
- **Felipe (franquia Individual):** **idêntica à do vendedor** — mesma navegação, mas o pedido de desconto vai ao superior dele (Master ou Supervisor), e o rodapé/avatar mostram "Franqueado · individual".
- **Marcelo (franquia Full):** xdash (KPIs da equipe) → Vendedores/ranking → Aprovações (pedidos dos vendedores dele) → aprova dentro da alçada ou escala ao Master → Comissões/Extrato do grupo.
- **Paula (supervisor):** xdash → equipe CLT + franquias diretas → Aprovações (CLT e franquias) → dentro da alçada aprova; acima, escala à Matriz.
- **Douglas (master):** xdash (operação própria + franquias, com os 20%) → Aprovações da rede → Vendas/Comissões consolidadas do grupo.
- **Ana (matriz):** mdash → Leads/Distribuição → **Aprovações (última instância)** → Acessos e permissões (classificar cadastros + política de alçada) → Configurações (usuários, seguradoras, modelos).

## 8. Impacto no que já documentamos

O mapeamento **confirma os GAPs e as 63 tasks** — nada muda de escopo. Ele **detalha** o que algumas tasks precisam entregar:

- **G1.4 (classificação de acesso):** implementar exatamente os 5 tipos e os campos condicionais da seção 5 — incluindo faixa Elite do CLT no próprio modal.
- **G1.5 (lista de usuários):** modal "Usuários do sistema" (usuário · tipo · supervisão · status).
- **G1.6 (área do grupo):** as 12 telas compartilhadas com escopo por `activeGroup()` e % por papel (20% fixo / personalizável / 0%).
- **G2.2 (bifurcação):** a franquia Individual usa **todas** as telas do vendedor, inclusive o tutorial do vendedor.
- **G3.4/G3.5:** inbox filtrada por nível + rede, e política por modelo × 7 seguradoras.
- **G6.3/G6.4 (tutoriais):** são 3 roteiros (não 6) — vendedor/franquia-individual, matriz e grupo — com ~148 passos no total; a estimativa de 4–6 dias segue válida.
