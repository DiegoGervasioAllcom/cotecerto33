# Plano — Frente 5 · Franquia Full como matrizinha (V11)

**Aberto em:** 03/08/2026 · **Gatilho:** a Lis respondeu as 6 perguntas em aberto
(`docs/PERGUNTAS_PARA_LIS.md`) e enviou `CoteCerto_Regras_Decididas.html` — as duas
travas que impediam planejar esta frente em detalhe (endereço das configurações e o
conteúdo da regra 12) caíram.

Este documento substitui a tabela solta de V11.5.1-7 em `docs/PLANO_TASKS_V11.md` por
um plano com sequência, dependências e o que já está construído de graça por outras
frentes.

## O que já existe hoje (achado ao planejar)

- **Régua de performance (D1, Frente 4) já tem um bloco `'full'`** em
  `regua_performance_config`, com valores-padrão próprios (janela 30d, atenção 22%/12d,
  travado 12%/18d, 3 cancelamentos) — só falta a **tela** da Full editar o próprio
  bloco. `fn_salvar_regua_performance`/`fn_calcular_performance_pessoa` já são
  agnósticas de bloco. V11.5.6 fica bem mais barata do que a tabela original sugeria.
- **`distribuicao_config` é singleton** (`id='default'`, `sla_segundos=180` fixo) — não
  existe SLA por empresa/franquia hoje. V11.5.3 precisa de tabela nova, não de coluna.
- **`app-shell.tsx` não tem nenhuma ramificação por `modelo`/Full** — o franqueado Full
  recebe hoje o mesmo menu do Master (áreas de rede), não o espelho de 16 áreas da
  Matriz. V11.5.4/V11.5.2 precisam desse recorte novo.
- **Comissão (G4) não olha `leads.canal_id`/origem em nenhuma migration** — confirmado
  por grep em todas as migrations de comissão. Isso não estava na tabela original de
  Frente 5; é demanda nova da regra 9 das Regras Decididas. Entra como **V11.5.8**.

## Decisões da Lis que fecham o desenho

- **V11.5.1 resolvido:** endereço definitivo é **Acessos e permissões › Personalização
  geral/Performance** (mesmo padrão da Matriz). A Central da Franquia fica **só** com a
  operação de leads (Central de leads + Distribuição · SLA · Canais). Já refletido no
  protótipo r41 (a caminho).
- **Regra 8:** Full é "matrizinha" — gerencia o próprio time com autonomia (inclui/exclui
  sem depender da Matriz, mas o vendedor dela se autocadastra e a fila é da própria
  franquia — já implementado em F9). Menu espelha a Matriz com **16 áreas**, de fora só
  Franquias e Configurações globais. Comissionamento e modelo operacional são
  **customizados por operação**, não uma tabela fixa por classificação.
- **Regra 9:** comissão por origem do lead (canal próprio da Full × repassado pela
  Matriz) é **definida pela Matriz**, nas configurações — não pela franquia.
- **Regra 10:** a Full define o próprio SLA, não precisa ser os 3 min da Matriz.
- **Regra 12 (parte Full):** a franqueada **poderá** ter a régua própria — coerente com
  a matrizinha; não é obrigatório ela ter uma diferente da Matriz, é opção dela ativar.

## Tasks

| Task     | Tag    | Descrição                                                                                                                                                 | Depende de       |
| -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| ~~V11.5.1~~ | —   | ✅ Resolvido — endereço: Acessos e permissões › Personalização geral/Performance                                                                          | —                |
| V11.5.2a | banco  | Menu de 16 áreas pro franqueado Full (espelho da Matriz sem Franquias/Configurações globais) — nova função/regra de escopo em `app-shell.tsx`/RLS         | —                |
| V11.5.2b | front  | **Central da Franquia**: só leads — Central de leads, Distribuição, SLA, Canais próprios (leads próprios × repassados da Matriz)                          | V11.5.2a          |
| V11.5.3  | banco  | Tabela de SLA **por empresa** (não mais singleton); repassado segue o SLA da Matriz, próprio segue o da Full                                                | V11.5.2a          |
| V11.5.4  | front  | Acessos e permissões da Full: Personalização geral/Performance espelhando a Matriz (Modelo Franquia/CLT, Desconto, Respostas, **Performance**, sem Diretores/Histórico) | V11.5.1, V11.5.2a |
| V11.5.5  | front  | Modelo CLT + complementos pra Full; cadastro direto passa pela configuração (produtos/canais/comissão por pessoa, selo "personalizado")                    | V11.5.4           |
| V11.5.6  | front  | Régua própria **opcional** da Full na sub-aba Performance — banco já existe (bloco `'full'` do D1); só falta permitir a Full chamar `fn_salvar_regua_performance`/ver seu próprio bloco | V11.5.4           |
| V11.5.7  | banco  | Lead repassado que dá perda ou estoura SLA **cruza a fronteira** e volta como Devolvido/Perda da Matriz                                                    | V11.5.3           |
| V11.5.8  | banco  | Comissão por origem do lead: regra diferente pra canal próprio × repassado, **definida pela Matriz** nas configurações (não pela franquia)                 | V11.5.2a          |
| V11.5.9  | testes | RLS + regras de negócio das tasks acima (escopo de 16 áreas, SLA por empresa, régua opcional, comissão por origem, cruzamento de fronteira)                | todas acima       |

## Riscos e decisões conscientes

1. **V11.5.2a (menu 16 áreas) é pré-requisito silencioso** de quase tudo — sem ele, a
   Full continua vendo o menu de Master e nenhuma das telas novas aparece. Vai primeiro.
2. **V11.5.3 muda o shape de `distribuicao_config`** (de singleton pra por-empresa) —
   precisa decidir se vira tabela nova (`sla_config` por `empresa_id`, com fallback pro
   singleton quando a empresa não tem override) em vez de alterar a tabela existente,
   pra não quebrar o SLA global da Matriz que já está em produção.
3. **V11.5.8 (comissão por origem) não estava na tabela original da Frente 5** — é
   escopo novo, descoberto só agora com as Regras Decididas. Fica dentro desta frente
   porque nasce exclusivamente do contexto Full (canal próprio vs repassado), mas é
   trabalho de tamanho comparável ao G4 original (regras de campanha/comissão) — vale
   tratar como sub-entrega própria dentro da frente, não como 1 task pequena.
4. **Fora de escopo desta frente:** Carteira de Recuperação (Lis decidiu V12); override
   de aprovação da Matriz sobre vendedor Full (Lis decidiu manter como está); escopo de
   leitura do Marketing/Assistente Comercial (decidido, mas é mudança de ~22 policies
   sem relação com a Full — task separada, fora desta frente).
5. **Hierarquia Coordenador acima dos Supervisores (regra 5):** investigado — H6
   deriva a alçada de desconto por `has_role`/cargo direto, não por `superior_id`
   recursivo pros dois Supervisores. Apontar `superior_id` deles pro Coordenador não
   teria efeito funcional hoje (o Coordenador já vê tudo via `empresas_visiveis`, igual
   à Matriz). Tratado como puramente organizacional — **sem task**, a menos que apareça
   um uso funcional concreto depois (notificação, escalonamento).

## Sequência de implementação

1. **Banco primeiro:** V11.5.2a (menu 16 áreas) → V11.5.3 (SLA por empresa) → V11.5.8
   (comissão por origem) → V11.5.7 (cruzamento de fronteira).
2. **Front depois, já com o banco pronto:** V11.5.2b (Central da Franquia) →
   V11.5.4 (Acessos/Personalização) → V11.5.5 (Modelo CLT) → V11.5.6 (régua opcional).
3. **V11.5.9 (testes)** fecha a frente, com `supabase db reset` limpo antes da contagem
   final — mesmo padrão das frentes anteriores.
