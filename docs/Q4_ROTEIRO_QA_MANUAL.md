# Q4 — Roteiro de QA manual por perfil (antes do go-live)

**Objetivo:** validar, à mão, os fluxos das 6 experiências de usuário em staging, na ordem em que um cliente real usaria o sistema. Este é o último item da lista Qualidade do V10 — tudo que é automatizável já está coberto por CI (`ci`, `db-tests`, `e2e`, gate de cobertura T9).

> **Ambiente:** `https://cote-certo.sandboxallcom.com`
> **Login inicial (Matriz):** `desenvolvimento@suppercerto.com.br` · senha `Supper@123!`
> As outras personas **não existem no seed** — você as cria pela própria aplicação (Bloco 0). Isso é proposital: o cadastro/aprovação de franquias e vendedores também é parte do teste.

## Como reportar um problema
Para cada item, marque ✅ (ok) / ❌ (bug) / ⚠️ (estranho, mas funciona). Ao achar um bug, anote: **tela**, **perfil logado**, **passo**, **o que esperava**, **o que aconteceu** (e print se der). Junte tudo e me manda que eu trato.

## As 6 experiências (5 perfis; `franquia` bifurca)
| Persona de teste | Perfil interno | Experiência | Tela inicial |
|---|---|---|---|
| Matriz | `matriz` | gestão total | Visão geral da Matriz |
| Master franqueado | `master` | gestão de grupo | Visão geral do grupo |
| Supervisor | `supervisor` | gestão de grupo | Visão geral do grupo |
| Franquia **Full** | `franquia` (modelo Full) | gestão de grupo | Visão geral do grupo |
| Franquia **Individual** | `franquia` (modelo Smart/Light/…) | vendedor | Cockpit do vendedor |
| Vendedor | `vendedor` | vendedor | Cockpit do vendedor |

---

## Bloco 0 — Matriz: montar a hierarquia (onboarding)
Logado como **Matriz**. Isso já testa Acessos, Configurações e o cadastro/aprovação.

- [ ] **Login** entra e cai na **Visão geral da Matriz** (não vê "Novo lead"). O selo da marca mostra MATRIZ.
- [ ] **Configurações** → abre; revise os cards (Distribuição de leads, Metas, Auditoria, Integrações, Notificações). Abra "Perfis e usuários" e confira os modais (Matriz / Franqueado / Vendedor / Todos).
- [ ] **Acessos e permissões** → aba **Personalização geral**: confira os modelos de franquia (Full vs Individual) e o modelo CLT.
- [ ] Crie ao menos **uma franquia Full** e **uma franquia Individual** (pelo fluxo de cadastro de franquia). Aprove-as.
- [ ] Crie/aprove **um Master** e **um Supervisor** vinculados a um grupo, e **ao menos 2 vendedores** (um sob a franquia Full, um avulso).
- [ ] Na aba **Pendentes** de Acessos: aprove os cadastros pendentes; confira que somem da lista e aparecem como ativos.
- [ ] Anote **e-mails e senhas** que você definiu para cada persona — vai logar com elas nos próximos blocos.

> Se o fluxo de criação de alguma persona não estiver óbvio na UI, **pare e me avise** — pode ser um gap de onboarding que a gente precisa fechar antes do go-live.

---

## Bloco 1 — Vendedor: fluxo de venda ponta a ponta
Faça **logout** e entre com o **vendedor** criado no Bloco 0.

- [ ] Cai no **cockpit (Início)**: vê "Novo lead"; selo CORRETOR. KPIs do dia carregam sem erro.
- [ ] **Atender agora**: se houver lead distribuído, "Assumir e iniciar" funciona; sem lead, mostra o estado vazio.
- [ ] **Novo lead** → preencha o **wizard de cotação** inteiro (6 etapas: Segurado → Seguro → Veículo → Perfil → Coberturas → Cálculo):
  - [ ] Máscaras funcionam (CPF/CNPJ, celular, CEP com busca de endereço, placa, valores em R$).
  - [ ] Busca de **CEP** preenche endereço; **FIPE** (marca/modelo) carrega e traz o valor.
  - [ ] Validação por etapa: tentar avançar com campo obrigatório vazio **bloqueia** e mostra o erro.
  - [ ] **Rascunho**: saia no meio (feche/volte) e reabra a cotação — os dados voltam.
  - [ ] Na etapa **Cálculo**, "Calcular" gera os prêmios por seguradora.
- [ ] **Cotações**: a cotação aparece na lista; abrir o detalhe mostra o comparativo de seguradoras.
- [ ] **Gerar proposta** a partir da cotação; ela aparece em **Propostas**.
- [ ] **Aceite & transmissão**: registrar transmissão da proposta.
- [ ] **Pipeline**: o lead/cotação transita de etapa (arrastar cartão).
- [ ] **Classificar perda**: pegue um lead e classifique como perdido (motivo + submotivo) — some do pipeline ativo.
- [ ] **Extrato de vendas**: mostra a venda e o total do período.
- [ ] **Mensagens prontas**: lista as mensagens; botão **Copiar** funciona.
- [ ] **Escopo (importante):** o vendedor **só enxerga os próprios leads/cotações/propostas** — não vê de outros vendedores.

---

## Bloco 2 — Franquia Individual
Logout → entre com a **franquia Individual**.

- [ ] Tem a **mesma navegação do vendedor** (vê "Novo lead"); selo FRANQUEADO com "· individual".
- [ ] Repasse rápido do fluxo de venda (Bloco 1) — deve se comportar igual ao vendedor.
- [ ] **Escopo:** vê só a própria operação (não a rede).

---

## Bloco 3 — Grupo (Master / Supervisor / Franquia Full)
Faça este bloco com **cada uma** das 3 personas de grupo (o comportamento é o mesmo; o alcance de rede muda).

- [ ] Login cai na **Visão geral do grupo** (`xdash`); **não** vê "Novo lead" nem "Distribuição"; vê a nav de **Vendedores**.
- [ ] Dashboard do grupo: KPIs, alertas e ranking de vendedores carregam.
- [ ] **Vendedores**: lista da rede; abrir um vendedor mostra o detalhe (KPIs, funil, performance por seguradora).
- [ ] **Pipeline geral**: kanban com os leads da rede; filtros por franquia/vendedor/origem/seguradora.
- [ ] **Vendas**, **Comissões**, **Premiações**, **Estornos**, **Renovações**, **Relatórios**: abrem e mostram só dados **da própria rede**.
- [ ] **Aprovações**: se houver pedido de desconto de um subordinado, aparece aqui para decidir.
- [ ] **Acessos (visão de equipe)**: vê a rede; consegue cadastrar vendedor (que sobe para aprovação da Matriz).
- [ ] **Escopo crítico:** cada persona de grupo **só vê a própria sub-rede** — Master não vê a rede de outro Master; Supervisor vê a rede sob ele. Confirme trocando entre elas.

---

## Bloco 4 — Matriz: telas de gestão
Volte para a **Matriz** e valide as telas de comando (a Matriz vê **tudo**).

- [ ] **Visão geral (Matriz)**: 9 KPIs, seletor de período, evolução mensal, alertas, rankings.
- [ ] **Leads** e **Distribuição**: distribuir leads pendentes (manual e automático); regras e simulação.
- [ ] **Aprovações (desconto)**: aprove / negue / faça **contraproposta** / **escale** um pedido. Confira: aprovar **atualiza o prêmio** automaticamente; contraproposta volta ao solicitante; escalar sobe na cadeia.
- [ ] **Comissões**: fechamento por competência; KPIs; comissão por franquia/seguradora; top vendedores.
- [ ] **Premiações**: cadastre uma campanha, lance um ganhador manualmente, marque **pago/a pagar**.
- [ ] **Estornos**: lista de vendas canceladas com prêmio/comissão revertidos.
- [ ] **Renovações**: apólices a vencer (janela de 60 dias); "Iniciar renovação" cria o lead na distribuição padrão.
- [ ] **Relatórios**: gere cada um dos 7 relatórios em **PDF** e em **Excel/CSV** e confira que baixam e abrem.
- [ ] **Supervisão**: caça-gargalos e comparativo de vendedores.
- [ ] **Acessos** e **Configurações**: já vistos no Bloco 0 — reconfirme que nada quebrou.

---

## Bloco 5 — Regras de negócio críticas (validar o comportamento, não só a tela)
- [ ] **Desconto multinível:** um vendedor pede desconto acima da alçada → sobe para o superior; sem política definida no nível, **escala até a Matriz**; aprovar **atualiza o prêmio** da proposta.
- [ ] **Comissão (G4):** conferir que o valor bate com a regra (fator pela média do vendedor; override de base desconta royalties; bônus Elite trimestral entra sobre a comissão). Comparar um caso simples na mão.
- [ ] **Renovação (G6):** apólice a 60 dias do vencimento vira lead **manual**; o lead entra na **distribuição padrão** (não vai direto pro vendedor original); apólice vencida sem ação → marcada como perdida.
- [ ] **Premiação (G5):** é **manual** e **só a Matriz** lança; grupo só vê as da própria rede.
- [ ] **Isolamento por rede (RLS):** o teste mais importante — em cada perfil, confirme que **não** aparece dado de outra rede/vendedor. Se um Master enxergar leads/comissões de fora da rede dele, é **bug de segurança grave** (reporte com prioridade).

---

## Limitações conhecidas (NÃO são bugs — já mapeadas no Q3)
Estas telas foram entregues em versão simplificada frente ao protótipo; estão no backlog estrutural (`docs/Q3_DIVERGENCIAS_PROTOTIPO.md`). **Não reporte como bug:**
- **Mensagens prontas:** é um CRUD simples; ainda não tem categorias/busca/botão WhatsApp nem variáveis preenchidas.
- **Pipeline (vendedor):** sem alternância Kanban/Tabela e sem os filtros/《cards ricos》 do protótipo.
- **Propostas:** sem a tela de negociação/versões (é lista read-only).
- **Aceite:** sem a timeline e o card de conferência final com checkbox.
- **Extrato:** sem o bloco de KPIs/estornos/campanha do protótipo.
- **Comissões:** o texto fala em "trilha de auditoria (autor/data/valor)" mas a UI ainda não exibe esse histórico.
- **Busca global** na topbar ainda não existe; **badge de contagem** em Aprovações ainda não aparece.

---

## Resultado
Ao terminar, me diga: (1) o que passou, (2) a lista de bugs achados (formato acima), (3) qualquer fluxo de onboarding que ficou confuso. A partir disso eu priorizo correções e a gente decide o que entra antes do go-live.
