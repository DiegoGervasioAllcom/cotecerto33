# Revisão: Formulário de Cotação (CoteCerto) vs. Contrato do Robô (Quiver)

Data: 16/08/2026
Escopo: comparação entre o formulário `/venda/novo-lead` (front) e `POST /cotacao` do robô Playwright. Revisão apenas — nenhuma alteração de código foi feita nesta etapa.

> **Fechamento em 17/08/2026.** Os 8 bloqueadores de alta gravidade e os itens 5-10
> das "Tasks de acompanhamento" (ver seção no final deste documento) foram corrigidos
> em 4 PRs (#176-#179), plano detalhado e status por task em
> `doc/PLANO_REVISAO_FORM_ROBO.md`. Seguem como decisão de produto em aberto, não como
> bug: `nomeHierarquico` (task 10, sem candidato claro no domínio do CoteCerto) e a
> distinção HDI Fit/Básico (parte da task 7). O item 11 ("Achado adicional") também
> foi corrigido junto.

## Veredito

O formulário e o contrato do robô divergem em pontos que hoje geram HTTP 422 no **caminho comum**, não só em casos de borda. Uma cotação de renovação, com blindagem, com acessórios ou de PJ não passa. O que passa hoje é um caminho estreito: seguro novo, PF, sem blindagem/kit gás/acessórios, com RCF preenchido manualmente e sem tocar no segundo select de "Tipo de cobertura".

---

## Bloqueadores confirmados (alta gravidade)

### 1. RCF vai vazio e o vendedor não percebe
`src/lib/quiver.functions.ts:306-307` usa `c.rcf_dm ?? undefined` / `c.rcf_dc ?? undefined`. Como `"" ?? undefined` avalia para `""`, a chave viaja vazia. O validator do robô (`cotacao.validator.ts:1517-1522`) rejeita string vazia quando o campo é informado — 422 garantido quando o vendedor não mexe no RCF.

Agravante de UX: em `StepCoberturas.tsx:104-121` os selects de RCF **não têm opção vazia** — a tela exibe "R$ 50.000,00" (primeira opção) enquanto o estado continua `""`. O vendedor vê preenchido e não está.

### 2. `cobertura.plano` com dois problemas
- O enum do front (`enumsCoberturas.ts:9`) tem `"Personalizada"` (feminino); o robô só aceita `personalizado` (`cotacao.validator.ts:1482`, normalização remove acento mas não o "a" final) → 422.
- Pior: o **mesmo estado** `f.tipoCobertura` é editado por um **segundo select** em `StepSeguro.tsx:110-126`, com um universo totalmente diferente (`Compreensiva`, `Casco (Incêndio, Roubo e Furto)`, `Casco (Colisão e Incêndio)`, `RCF (Somente terceiros)`) — nenhum desses valores existe no enum do robô. Qualquer interação com esse segundo select corrompe o campo.

### 3. Renovação nunca funciona
`StepSeguro.tsx:204+` coleta o bloco "Dados da apólice anterior" com asterisco de obrigatório (`seguradoraAnterior`, `sucursalAnterior`, `apoliceAnterior`, `coberturaAnterior`, `statusApoliceAnterior`, `inicioVigenciaAnterior`, `fimVigenciaAnterior`), mas `montarPayloadQuiver` envia só `{ tipo, seguradorasDisponiveis }` (`quiver.functions.ts:158-161`). O robô exige os 7 campos quando `seguro.tipo` é Renovação (`cotacao.validator.ts:429-452`) → toda cotação de renovação é 422.

### 4. Máscara `R$` em 11 campos monetários
`maskBRL` grava `"R$ 1.000,00"`. `semPrefixoMoeda` existe e está correto em `appMorte`, `appInvalidez`, `danosMorais`. Ficaram de fora: `valorBlindagem`, `valorKitGas`, `valorAdaptacaoPcd` (`quiver.functions.ts:199,205,213`) e os 8 campos de `acessorios_detalhes` (`radioAmFm`, `cdPlayer`, `dvdPlayer`, `rodasLigaLeve`, `kitMultimidia`, `capotaFibra`, `equipamentoEspecial`, `telefoneCelularVeicular`), espalhados crus. O regex do robô remove espaço e ponto de milhar, mas não o `R$` → 422.

### 5. O gate `podeCalcular` protege os campos errados
`useSimulacaoCalculo.ts:127-134` exige `cpf, nome, marca, modelo, anoModelo, seguradorasSel`. O robô **não conhece marca/modelo/ano** (identifica o veículo pela placa via FIPE do portal) e exige, sem estarem no gate: `placa`, `email`, `cep`, `telefone`, `cepPernoite`, `cepCirculacao`, `kmMes`. O botão libera o cálculo com o que o robô ignora e sem o que ele obriga.

### 6. CPF/CNPJ
O campo é rotulado "CPF/CNPJ" com `maskCpfCnpj` (`StepSegurado.tsx:30`), aceitando 14 dígitos. `validarCpf.ts` do robô só aceita 11 dígitos com módulo 11 → segurado PJ é 422 certo.

### 7. Seguradoras: o silêncio inverte a intenção
O banco semeia 18 seguradoras (`20240101000010_seguradoras_planos.sql:58-61`), o robô aceita 12. `mapSeguradoras` (`quiver.functions.ts:70-74`) descarta as desconhecidas **em silêncio** (Itaú, Ezze, Zurich, Alfa, Darwin, Pier, Indiana, Sompo). Se o vendedor marcar só dessas, a lista mapeada fica vazia, o campo é omitido (linha 160) e o robô cota **todas as 12** — o oposto do pedido, sem aviso.

### 8. Valores órfãos de toggles desligados
Em `AcessoriosFold.tsx:152` os inputs somem quando o toggle vai para "não", mas os valores **permanecem** em `acessorios_detalhes`, espalhado inteiro (`quiver.functions.ts:222`) sem checar o toggle atual. O robô recusa explicitamente ("deve ser enviado apenas quando X é Sim" — `cotacao.validator.ts:1210`). Mesmo padrão em `antifurto_detalhes` (linha 169): trocar de "Bloqueador" para "Não" deixa o sub-campo anterior para trás.

*(Verificado também: `bloqueadorPorto` reaproveitado na seção Rastreador está correto — o robô aceita nos dois modos, apesar da mensagem de erro sugerir o contrário.)*

---

## Riscos condicionais (média gravidade)

- `categoriaTaxiVeiculo` / `utilizacaoLocadoraContrato` — obrigatórios no robô quando `tipoUso` é Táxi/Locadora, opcionais no front.
- `ramoAtividadeComercialProfissional` / `profissaoPrincipalCondutor` — enviados com `|| ""` quando `tipoUso ≠ Particular`; wizard não bloqueia avanço com o bloco em branco.
- Bloco do proprietário (`relacaoSeguradoComProprietario` + CPF/sexo/nascimento/estado civil) sem a relação escolhida.
- Bloco do principal condutor emitido inteiro com `?? ""` quando `condutorMesmo = 'nao'`.
- `coberturaBlindagem` podendo ir vazio quando `blindagem = Sim`.
- `nomeHierarquico` nunca é enviado; o fallback do robô só age se `NOME_HIERARQUICO_DEFAULT` estiver setada (vazia no `.env.example`) — cai num valor hardcoded no POM.
- `hdi seguros fit` / `hdi seguros basico` são produtos distintos no robô; o front só oferece "HDI" genérico.
- 5 campos `franquia*` por acessório aceitos pelo robô e ausentes do front.

## Baixa gravidade / custo de tela

Cerca de 45 colunas são preenchidas, gravadas e nunca enviadas (endereço detalhado, nascimento do segurado, dados FIPE do veículo). Não quebra nada — é custo de tela, não de integração. Há também campos "fantasma" no tipo `Form` sem input em nenhuma etapa, e pares duplicados de controles sobre o mesmo assunto (`blindado` vs `blindagemAtiva`, `usoComercial` vs `usoComercialDoisDias`) onde só um lado chega ao robô.

### Achado adicional (17/08/2026)

`premioNumerico()` em `src/components/venda/cotacoes/quiver-resultado.ts:78-85` só lê `opcao?.avista` pra calcular o valor numérico usado em `ordenarResultados()`. Cards que só oferecem parcelado (sem preço à vista — ex.: Suhai "Roubo e Furto c/ Assistência") retornam `Infinity` e vão pro fim da lista ordenada, mesmo sendo uma oferta real e válida. Mesma raiz do bug corrigido na RPC `registrar_premios_quiver` (PR #175) — vale aplicar o mesmo fallback (extrair de `opcao.parcelas` quando `avista` ausente) no front, por consistência de ordenação.

---

## Tasks de acompanhamento criadas

1. Corrigir RCF enviado vazio (danosMateriaisTerceiros/danosCorporaisTerceiros)
2. Corrigir enum cobertura.plano e select duplicado de tipoCobertura
3. Implementar bloco "apólice anterior" para cotações de Renovação
4. Remover máscara "R$" antes de enviar campos monetários que ainda vazam
5. Corrigir gate podeCalcular para refletir campos reais do robô
6. Decidir tratamento de CPF vs CNPJ no campo "CPF/CNPJ"
7. Tratar seguradoras não suportadas pelo robô
8. Corrigir valores órfãos em antifurto_detalhes/acessorios_detalhes ao desligar toggle
9. Revisar campos condicionais obrigatórios não gatilhados
10. Ajustar nomeHierarquico default e enum HDI Fit/Básico
11. premioNumerico() no front também ignora cards só-parcelado (sem avista) — ver "Achado adicional" acima
