# Documentação Técnica — CoteCerto V10

Desenho de banco e front para executar o plano de tasks (`PLANO_TASKS_V10.md`). Diagramas em Mermaid (renderizam no GitHub/VS Code).

---

## 1. Hierarquia de usuários (alvo V10)

```mermaid
flowchart TD
    MATRIZ["🏢 Matriz<br/><i>comando da rede</i>"]
    MASTER["Master franqueado<br/><i>20% da equipe + Elite</i>"]
    SUPER["Supervisor (Matriz)<br/><i>% personalizável</i>"]
    OPPROP["Operação própria<br/><i>vendedores internos</i>"]
    FRQM["Franquia<br/><i>Individual ou Full</i>"]
    CLT["Vendedor CLT<br/><i>modelo progressivo</i>"]
    FRQS["Franquia<br/><i>Individual ou Full</i>"]
    VF1["Vendedor de franquia<br/><i>só modelo Full</i>"]
    VF2["Vendedor de franquia<br/><i>só modelo Full</i>"]

    MATRIZ --> MASTER
    MATRIZ --> SUPER
    MASTER --> OPPROP
    MASTER --> FRQM
    SUPER --> CLT
    SUPER --> FRQS
    FRQM --> VF1
    FRQS --> VF2
```

**Regra:** todo usuário tem `superior_id`. Franquia **Individual** (Smart, Conecta, Light, Link, Flex) = opera como vendedor, sem equipe. Franquia **Full** = gere equipe própria.

---

## 2. Banco de dados — estado atual (núcleo)

```mermaid
erDiagram
    empresas ||--o{ profiles : "empresa_id"
    empresas ||--o{ empresas : "parent_id (1 nível)"
    profiles ||--o{ user_roles : "user_id"
    empresas ||--o{ leads : "empresa_id"
    leads ||--o{ lead_eventos : "lead_id"
    leads ||--o{ cotacoes : "lead_id"
    cotacoes ||--o{ cotacao_premios : ""
    cotacoes ||--|| cotacao_segurado : ""
    cotacoes ||--|| cotacao_veiculo : ""
    cotacoes ||--o{ propostas : "cotacao_id"
    propostas ||--o{ comissao_lancamentos : "proposta_id"
    seguradoras ||--o{ planos : "seguradora_id"
    modelos_franquia ||--o{ empresas : "modelo"

    empresas {
        uuid id PK
        text nome
        text documento "sem unique ⚠"
        enum tipo "pj|pf"
        enum status
        uuid parent_id FK
    }
    profiles {
        uuid id PK "auth.users"
        uuid empresa_id FK
        text nome
        text email "sem unique ⚠"
        enum status
    }
    user_roles {
        uuid user_id FK
        enum role "matriz|master|vendedor|franqueado"
    }
    modelos_franquia {
        uuid id PK
        text nome "Smart..Flex"
        enum tipo "franqueada|clt ⚠"
        numeric perc_comissao_padrao
    }
    comissao_lancamentos {
        uuid vendedor_id FK
        text tipo "credito|debito"
        numeric valor "sem check>0 ⚠"
    }
```

⚠ = pontos corrigidos nas listas S e D do plano.

---

## 3. Banco de dados — mudanças V10 (alvo)

```mermaid
erDiagram
    profiles ||--o{ profiles : "superior_id 🆕 (cadeia multinível)"
    profiles ||--o{ desconto_solicitacoes : "solicitante_id"
    desconto_solicitacoes ||--o{ desconto_trilha : "solicitacao_id"
    desconto_politicas }o--|| modelos_franquia : "modelo"
    desconto_politicas }o--|| seguradoras : "seguradora"
    respostas_padrao }o--|| seguradoras : ""
    campanhas_elite ||--o{ comissao_regras : ""
    cotacoes ||--o{ desconto_solicitacoes : "cotacao_id"

    profiles {
        uuid superior_id FK "🆕 a quem reporta"
        enum role "🆕 + supervisor"
    }
    modelos_franquia {
        enum tipo "🆕 individual|full"
    }
    desconto_politicas {
        uuid id PK
        text modelo "franquia_ind|franquia_full|master|supervisor"
        uuid seguradora_id FK
        numeric pct_maximo "check 0-100"
        jsonb condicoes
    }
    desconto_solicitacoes {
        uuid id PK
        uuid cotacao_id FK
        uuid solicitante_id FK
        text nivel_atual "quem deve responder"
        numeric pct_pedido "check 0-100"
        text status "pendente|aprovado|contraproposta|negado|escalado"
    }
    desconto_trilha {
        uuid solicitacao_id FK
        uuid autor_id FK
        text acao
        numeric pct_concedido
        timestamptz criado_em "trilha auditável"
    }
    respostas_padrao {
        uuid seguradora_id FK
        text destinatario_tipo
        text texto
    }
    comissao_regras {
        text papel "master 20% | supervisor % | clt progressiva"
        jsonb parametros
    }
    campanhas_elite {
        text tipo "elite_master|elite_franqueado"
        jsonb faixas
    }
```

**Novas migrations (numeração a partir de 040):**

> Desde 13/07/2026 as migrations são gerenciadas pela Supabase CLI em `supabase/migrations/` (as 000–039 foram importadas como baseline; `/migrations` é histórico read-only). Criar novas com `bun run db:new <nome>`; a numeração 040+ abaixo é a referência lógica de conteúdo.

| Migration | Conteúdo                                                        | Task                      |
| --------- | --------------------------------------------------------------- | ------------------------- | ---- |
| 040       | `security_invoker` nas views + fechar policies permissivas      | S1–S4                     |
| 041       | Checks de tamanho/faixa + normalização e unique de documentos   | D1–D3                     |
| 042       | Enum `perfil` + `'supervisor'`; `profiles.superior_id`; índices | G1.1                      |
| 043       | `empresas_visiveis()` multinível + policies revisadas           | G1.2–G1.3                 |
| 044       | `modelos_franquia.tipo` → `individual                           | full` + migração de dados | G2.1 |
| 045       | Tabelas de desconto (4) + RLS por nível                         | G3.1                      |
| 046       | RPCs de desconto (solicitar/aprovar/contrapropor/negar/escalar) | G3.2                      |
| 047       | `comissao_regras` + `campanhas_elite` + motores (RPC/trigger)   | G4.1–G4.4                 |
| 048       | Premiações (modelo de dados)                                    | G5.1                      |
| 049       | Renovações: cron de avisos                                      | G6.1                      |

---

## 4. Fluxo do desconto multinível

```mermaid
sequenceDiagram
    actor V as Vendedor/Franquia
    participant COT as Cotação (UI)
    participant RPC as RPC solicitar_desconto
    participant DB as desconto_solicitacoes
    actor SUP as Superior imediato
    actor MTZ as Matriz

    V->>COT: pede desconto adicional (%)
    COT->>RPC: solicitar_desconto(cotacao, pct)
    RPC->>RPC: resolve superior via profiles.superior_id
    RPC->>DB: insert (nivel_atual = superior) + trilha
    SUP->>DB: inbox: pedidos do meu nível
    alt dentro da alçada (desconto_politicas)
        SUP->>DB: aprovar / contrapropor / negar (+ trilha)
    else acima da alçada
        SUP->>DB: escalar → nivel_atual sobe 1 nível (+ trilha)
        MTZ->>DB: última instância decide
    end
    DB-->>V: notificação do resultado na cotação
```

**Caminhos de aprovação:** Vendedor CLT → Supervisor → Matriz · Franquia Individual → Master/Supervisor → Matriz · Vendedor de franquia → Franqueado Full → Master → Matriz.

**Regra de ouro:** `alcada_for(modelo, seguradora)` e a decisão "aprova × escala" são validadas **na RPC (servidor)** — o front apenas exibe.

---

## 5. Arquitetura do front

```mermaid
flowchart LR
    subgraph Rotas["src/routes"]
        AUTH["auth.* <br/>login/cadastro/pendente"]
        subgraph APP["_authenticated"]
            VENDA["venda/*<br/>cockpit vendedor"]
            CMD["comando/*<br/>gestão de leads"]
            OP["operacao/*<br/>matriz"]
            APROV["aprovacoes 🆕<br/>inbox desconto"]
        end
    end
    subgraph Estado
        RQ["react-query<br/>cache servidor"]
        AUTHCTX["AuthProvider<br/>sessão + role + superior 🆕"]
    end
    subgraph Dados
        SB["supabase-js<br/>anon key + RLS"]
        SF["server functions<br/>service_role (cadastro/admin)"]
        RPCs["RPCs security definer<br/>regras de negócio"]
    end
    Rotas --> Estado --> SB
    SB --> RPCs
    AUTH --> SF
```

### Regras de navegação por perfil (alvo)

| Perfil                  | Grupos de menu                                   | Observação                     |
| ----------------------- | ------------------------------------------------ | ------------------------------ |
| Matriz                  | comando + operacao + aprovacoes                  | vê tudo; última instância      |
| Master                  | venda própria + comando (rede dele) + aprovacoes | dashboards escopados (xdash)   |
| Supervisor 🆕           | comando (CLT + franquias diretas) + aprovacoes   | role novo                      |
| Franquia Full           | venda + equipe própria + aprovacoes              | com ranking de equipe          |
| Franquia Individual     | **só venda (cockpit vendedor)**                  | bifurcação `isFranqIndividual` |
| Vendedor (CLT/franquia) | venda                                            | solicita desconto, não aprova  |

### Convenções de implementação

1. **Gate por role no `app-shell.tsx` (`canSee`)** — estender para `supervisor` e para a bifurcação Individual/Full; nunca esconder só no menu: a RLS é a barreira real.
2. **Toda regra de dinheiro em RPC** — front não calcula comissão nem valida alçada.
3. **Formulário = zod schema espelhando constraint do banco** (lista D).
4. **Tipos gerados** (`supabase gen types`) — proibido `any` novo.
5. **Telas novas seguem o protótipo** `cotecerto_prototipo_v10.html` como especificação de UX (abrir no navegador; personas de teste na seção 6 do Handoff).
6. **Migrations numeradas sequencialmente** (040+), aplicadas via Supabase CLI, staging antes de produção, cada uma com teste de RLS.
7. **Tudo em Docker** (lista K do plano): front containerizado (Dockerfile multi-stage), `docker-compose` de dev e de produção (proxy + TLS + rate limit), compose do Supabase self-hosted versionado no repositório, imagem construída no CI e deploy com runbook de rollback.

---

## 6. Ordem de execução (visão macro)

```mermaid
flowchart LR
    P["0 · Pré-obra<br/>+ S · Segurança<br/>(2-3 sem)"] --> D["D · Integridade"]
    D --> G1["1 · Hierarquia"]
    G1 --> G2["2 · Ind/Full"]
    G2 --> G3["3 · Desconto"]
    G1 --> G4["4 · Comissão"]
    G3 --> Q["7 · Qualidade<br/>+ QA final"]
    G4 --> Q
    P -.paralelo.-> G5["5 · Telas<br/>6 · Renov/Tutoriais"]
    G5 --> Q
```

Referências: `ANALISE_LACUNAS_V10.md` (o quê e por quê) · `PLANO_TASKS_V10.md` + `clickup_tasks_v10.csv` (tasks) · `MAPA_PROTOTIPO_PERFIS.md` (comportamento exato por perfil: navegação, escopo de dados, campos condicionais, tutoriais) · Handoff TI V10 (recomendações de produção).
