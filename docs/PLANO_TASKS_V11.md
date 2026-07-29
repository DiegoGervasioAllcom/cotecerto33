# Plano de Tasks — CoteCerto V11

**Base:** `docs/ANALISE_LACUNAS_V11.md` (corte 28/07/2026) · pacote V11 em `docs/v11/`

**Referência de UX:** `cotecerto_prototipo_v11.html` (build 28/07 · r40)

**Fonte da verdade das regras:** `docs/v11/FLUXOS_OPERACIONAIS.html`

## Como ler este plano

As tasks seguem a numeração `V11.<etapa>.<n>` e espelham as etapas aprovadas do
Relatório DE/PARA. Cada linha traz a tag do agente responsável (`banco`, `front`,
`infra`, `testes`) conforme o fluxo obrigatório do `AGENTS.md`: **planejador → especialista
→ testes → revisor**, com aprovação explícita do usuário antes de qualquer implementação.

A Definition of Done do `AGENTS.md` vale integralmente, com uma troca: onde se lê
"tela igual ao protótipo V10", leia-se **protótipo V11 r40**.

## Frente 0 · Pré-obra da V11

Sem isso, toda tela da V11 nasce em cima de premissa errada.

| Task    | Tag     | Descrição                                                                                             | Depende de |
| ------- | ------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| V11.0.1 | front   | Diffar o CSS do protótipo r40 contra `src/styles/proto.css` e aplicar o delta (regra 6: byte a byte)  | —          |
| V11.0.2 | banco   | Estender `public.perfil` com `coordenador`; decidir se supervisor Vendas × Operacional é valor de enum ou cargo | —  |
| V11.0.3 | banco   | Tabela de **cargos** + áreas de escopo (7 presets + Vendedor Matriz), com RLS e checks                | V11.0.2    |
| V11.0.4 | banco   | Taxonomia única de **canais** (item 9 do Handoff): uma tabela alimentando captação, aprovação, funis e Central da Full | — |
| V11.0.5 | banco   | Marcação de **diretor** no cadastro (mín. 2, não é cargo) + RPC que valida senha de diretor no servidor | V11.0.2   |
| V11.0.6 | banco   | **Histórico append-only** com DE/PARA em JSON, sem `UPDATE`/`DELETE` para a aplicação (item 7)         | —          |
| V11.0.7 | testes  | Testes de RLS/grants: histórico não editável, política sem diretor é rejeitada no backend             | V11.0.5, V11.0.6 |
| V11.0.8 | banco   | Cadeia hierárquica: Master passa a responder ao Coordenador; revisar `superior_id` e `empresas_visiveis()` | V11.0.2 |

## Frente 1 · Convite Supper e porta de entrada

⚠️ **Ordem obrigatória.** A Etapa 1 remove o autocadastro. Nada de `auth.cadastro.tsx`
sai do ar antes de V11.1.4 estar de pé, e a criação direta pela Matriz continua
funcionando como exceção durante toda a transição.

| Task    | Tag    | Descrição                                                                                        | Depende de |
| ------- | ------ | ------------------------------------------------------------------------------------------------ | ---------- |
| V11.1.1 | banco  | Tabela de **convites**: token nominal, uso único, validade configurável (demo 7d), perfil e vínculo embutidos | V11.0.2, V11.0.3 |
| V11.1.2 | front  | Modal Convidar em 4 escopos: Matriz interno (7 cargos + Vendedor Matriz), Matriz externo (Master, Individual direta), Master (franquias e vendedores dele), Full (só Vendedor da própria franquia) | V11.1.1 |
| V11.1.3 | front  | Saídas do convite: WhatsApp via wa.me, Copiar, **PDF com arte oficial e link clicável**, pré-visualização no modal | V11.1.2 |
| V11.1.4 | front  | Rota **`/convite/{código}`** (item 1): valida token, abre cadastro pré-preenchido com perfil e vínculo em texto fixo | V11.1.1 |
| V11.1.5 | front  | Erro amigável para link expirado/reusado, com opção de pedir novo convite                        | V11.1.4    |
| V11.1.6 | front  | Botão **"Quero falar com a Cote Certo"** no login: nome, e-mail, tema, mensagem → e-mail à Matriz, sem persistir | V11.2.1 (e-mail) |
| V11.1.7 | front  | Remover o cadastro espontâneo de `auth.cadastro.tsx`; criação direta pela Matriz vira exceção com log | V11.1.4, V11.2.3 |
| V11.1.8 | testes | E2E do convite: emitir → abrir link → cadastrar → cair na fila certa; e os casos de expirado e reuso | V11.1.4 |

## Frente 2 · Filas de aprovação, e-mails e senha

| Task    | Tag    | Descrição                                                                                       | Depende de |
| ------- | ------ | ----------------------------------------------------------------------------------------------- | ---------- |
| V11.2.1 | infra  | **E-mails reais** (item 2): boas-vindas com escopo, pendência com motivo, recusa — pelos modelos de `MODELOS_EMAIL_ACESSO.html`. Nenhum e-mail carrega senha | — |
| V11.2.2 | front  | **Tela Criar senha** (item 3): link 48h de uso único, hash bcrypt/argon2, política mínima 8+ com letras e números | V11.2.1 |
| V11.2.3 | banco  | Roteamento da fila pelo vínculo estruturado do pedido (trilha/perfil/vincTipo/vincId) — vendedor de Full **nunca** chega à Matriz | V11.1.1 |
| V11.2.4 | front  | Pendentes em dois blocos: time interno no bloco Matriz, rede no bloco Externos                  | V11.2.3    |
| V11.2.5 | front  | Fila própria da Franquia Full, que aprova o vendedor dela sem a Matriz                          | V11.2.3    |
| V11.2.6 | front  | Modal de análise travado no que o convite definiu; "Reclassificar" só como exceção registrada   | V11.2.3    |
| V11.2.7 | front  | Na aprovação: seletor de Supervisor de Vendas (Master), cargo + áreas + janela (interno), produtos e canais com botão "Todos". Master franqueado **não** recebe produtos/canais | V11.0.3, V11.0.4 |
| V11.2.8 | banco  | Produtos padrão por bloco (interno: todos · externo: só Auto), herdados na aprovação            | V11.0.4    |
| V11.2.9 | testes | RLS por perfil nas duas filas: cada bloco vê só o seu; Full não vê pendente da Matriz e vice-versa | V11.2.3  |

## Frente 3 · Cadastros e ciclo de vida

| Task    | Tag    | Descrição                                                                                          | Depende de |
| ------- | ------ | -------------------------------------------------------------------------------------------------- | ---------- |
| V11.3.1 | front  | Aba **Cadastros Matriz** unificada: colaboradores + Vendedores Matriz, filtros de cargo/ano, busca, Configurar/Excluir | V11.0.3 |
| V11.3.2 | front  | Aba **Cadastros Rede** nova: Masters, franquias com modelo visível/filtrável, vendedores; travas de exclusão | V11.0.8 |
| V11.3.3 | front  | "Cadastro manual · exceção" ao lado de cada Convidar: selo amarelo, vai direto à classificação, entra no log | V11.0.6, V11.1.2 |
| V11.3.4 | front  | Master **convida e acompanha** ("Meus cadastrados" com status, lembrete à Matriz) — deixa de cadastrar direto | V11.1.2 |
| V11.3.5 | front  | Master **solicita** desligamento (vendedor e franquia) com motivo; Matriz aprova/nega, com trava se houver time | V11.3.4 |
| V11.3.6 | banco  | Motivo **obrigatório** em todo desligamento (hoje `desligado_motivo` é opcional) + "Detalhes"       | —          |
| V11.3.7 | front  | Excluído vai para Desligamentos; separar **situação do cadastro** (ativo/suspenso/desligado) do **sinal de performance** | V11.4.1 |

## Frente 4 · Régua de performance

| Task    | Tag    | Descrição                                                                                       | Depende de |
| ------- | ------ | ----------------------------------------------------------------------------------------------- | ---------- |
| V11.4.1 | banco  | Tabelas da régua: **duas réguas independentes** (interno e rede) + a da franquia, com histórico de alteração | V11.0.6 |
| V11.4.2 | front  | Personalização geral › **Performance**: configurar as réguas, salvando com senha de diretor      | V11.4.1, V11.0.5 |
| V11.4.3 | banco  | **Job periódico** (item 5) que recalcula OK/Atenção/Travado por bloco — sem botão manual         | V11.4.1    |
| V11.4.4 | banco  | Travado + pausa ativa sai da distribuição automática; reativação exige registro de quem revisou  | V11.4.3    |
| V11.4.5 | front  | Selo nas listas; **clicar no selo** abre resumo com motivo em números e ações do supervisor (notificar / revisar-reativar) | V11.4.3 |
| V11.4.6 | testes | Travado não recebe lead do distribuidor; reativação sem registro é rejeitada                    | V11.4.4    |

## Frente 5 · Franquia Full como matrizinha

| Task    | Tag    | Descrição                                                                                        | Depende de |
| ------- | ------ | ------------------------------------------------------------------------------------------------ | ---------- |
| V11.5.1 | —      | **Decisão da Lis (item 11):** endereço único das configurações da Full — Central da Franquia × Acessos › Personalização. Bloqueia a tela final | — |
| V11.5.2 | front  | **Central da Franquia**: leads próprios × repassados da Matriz, SLA e canais próprios            | V11.0.4, V11.5.1 |
| V11.5.3 | banco  | SLA por origem do lead: repassado segue o SLA da Matriz, próprio segue o da Full                 | V11.5.2    |
| V11.5.4 | front  | Acessos da Full com 5 abas espelhando a Matriz                                                   | V11.2.5, V11.3.1 |
| V11.5.5 | front  | Modelo CLT + complementos; cadastro direto passando pela **configuração** (produtos/canais/comissão por pessoa, selo "personalizado") | V11.2.7 |
| V11.5.6 | banco  | Régua e histórico próprios da Full                                                               | V11.4.1, V11.0.6 |
| V11.5.7 | banco  | Lead repassado que dá perda ou estoura SLA **cruza a fronteira** e volta como Devolvido/Perda da Matriz | V11.5.3 |

## Frente 6 · Governança e histórico

| Task    | Tag    | Descrição                                                                                       | Depende de |
| ------- | ------ | ----------------------------------------------------------------------------------------------- | ---------- |
| V11.6.1 | front  | Senha de diretor nos **9 botões "Salvar política"** (um por aba), padronizados                   | V11.0.5    |
| V11.6.2 | front  | Mensagem "Seu acesso não permite esse tipo de alteração" para quem não é diretor                 | V11.0.5    |
| V11.6.3 | front  | Tela **Histórico** com DE/PARA, filtro por área persistente                                     | V11.0.6    |
| V11.6.4 | banco  | Incluir/remover diretor exige aprovação do Diretor Geral/CEO (dupla aprovação)                  | V11.0.5    |
| V11.6.5 | testes | Toda gravação de política gera linha com antes/depois; alteração sem diretor falha **no backend** | V11.0.7   |

## Frente 7 · Visão geral com período único

| Task    | Tag    | Descrição                                                                                       | Depende de |
| ------- | ------ | ----------------------------------------------------------------------------------------------- | ---------- |
| V11.7.1 | banco  | **Período único** server-side (item 8): dia/semana/quinzena/mês/personalizado                    | —          |
| V11.7.2 | front  | Todos os widgets da Visão geral lendo a mesma janela — hoje são 4 opções mensais no cliente (`visao-geral.tsx`) | V11.7.1 |
| V11.7.3 | front  | **4 funis por canal** (Movida/Google/Facebook/Manual) escalando com o período                    | V11.7.1, V11.0.4 |
| V11.7.4 | front  | **Alertas clicáveis** derivados do estado real                                                   | V11.7.2    |

## Frente 8 · Menus e escopo por perfil

| Task    | Tag    | Descrição                                                                                       | Depende de |
| ------- | ------ | ----------------------------------------------------------------------------------------------- | ---------- |
| V11.8.1 | front  | Menu do **Coordenador Comercial**: as 17 áreas (vê tudo que a Matriz vê, mas não altera comissionamento por não ser diretor) | V11.0.2 |
| V11.8.2 | front  | Menu do **Supervisor de Vendas**: time comercial, com alçada de desconto nas Aprovações           | V11.0.2    |
| V11.8.3 | front  | Menu do **Supervisor Operacional**: Leads, Distribuição, Acessos — sem alçada de desconto        | V11.0.2    |
| V11.8.4 | front  | Menu recortado pelas áreas do cargo (Backoffice, Assistente Comercial, Marketing)                | V11.0.3    |
| V11.8.5 | banco  | Alçada de desconto passa a ser exclusiva do Supervisor de Vendas; cadeia externa ganha Master → Coordenador → Matriz | V11.0.8 |
| V11.8.6 | testes | Escopo por perfil dos 4 perfis novos, positivo e negativo (skill `teste-rls`)                    | V11.8.5    |

## Frente 9 · Fora do caminho crítico

| Task    | Tag    | Descrição                                                                                       | Depende de |
| ------- | ------ | ----------------------------------------------------------------------------------------------- | ---------- |
| V11.9.1 | infra  | **WhatsApp Business API** (item 4): convite com PDF anexado automaticamente, sem passo manual. Exige conta e aprovação de template | V11.1.3 |
| V11.9.2 | —      | **Decisão pendente:** Carteira de Recuperação está nos Fluxos mas não no protótipo r40 — entra na V11 sem referência visual ou fica para a V12? | — |
| V11.9.3 | —      | **Pedir à Lis:** documento "Regras Decididas", citado pelo DE/PARA e pelo Handoff e ausente do pacote. Regra 12 (régua) e regra 5 (escopos dos presets) dependem dele | — |
| V11.9.4 | infra  | **Persistência geral** (item 10): filas, cadastros, solicitações e motivos em banco — varredura final de que nada ficou só no navegador | todas |

## Sequência recomendada

1. **Frente 0 inteira.** Enum, cargos, canais, diretor e histórico são fundação de quase
   toda task das outras frentes. Nenhuma tela antes disso.
2. **V11.9.3 em paralelo** — pedir "Regras Decididas" agora, porque a Frente 4 trava sem ele.
3. **Frente 1 + V11.2.1/V11.2.2** (convite, e-mails, senha), respeitando a ordem: o
   autocadastro só sai em V11.1.7, depois da rota do convite estar funcionando.
4. **Frente 2 e Frente 3** — filas e cadastros, que é onde o convite vira acesso.
5. **Frente 8** junto da Frente 2: os menus dos perfis novos precisam existir para
   testar as filas por perfil.
6. **Frente 4** (régua) e **Frente 6** (governança), que dependem de histórico e diretor.
7. **Frente 5** (Full) depois de V11.5.1 decidido pela Lis.
8. **Frente 7** (visão geral) pode correr em paralelo a partir da Frente 2 — só depende
   da taxonomia de canais.
9. **Frente 9** por último, exceto V11.9.3 e V11.9.2 que são pedidos/decisões imediatos.

## Decisões pendentes que bloqueiam tasks

| # | Pendência                                                             | Bloqueia            | Com quem |
| - | --------------------------------------------------------------------- | ------------------- | -------- |
| 1 | Documento "Regras Decididas" não veio no pacote                        | Frentes 4 e 2 (escopos) | Lis  |
| 2 | Endereço único das configurações da Full (item 11 do Handoff)          | V11.5.2, V11.5.4    | Lis      |
| 3 | Carteira de Recuperação: V11 sem referência visual, ou V12?            | V11.9.2             | Lis      |
| 4 | Supervisor Vendas × Operacional: valores de enum ou cargos da tabela?  | V11.0.2 → cascata   | técnica  |
