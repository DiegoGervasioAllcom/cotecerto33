export type Form = {
  // Lead Manual — origem (capturada no gate antes do wizard, V11)
  canalOrigem: string;
  // Segurado
  cpf: string;
  pessoa: string;
  nome: string;
  nomeSocial: string;
  nasc: string;
  sexo: string;
  estadoCivil: string;
  celular: string;
  email: string;
  cep: string;
  numero: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  // Seguro
  tipoSeguro: string;
  ramo: string;
  categoria: string;
  vigIni: string;
  vigFim: string;
  ciaAtual: string;
  apoliceAtual: string;
  ciAtual: string;
  classeBonus: string;
  seguradorasSel: string[];
  tipoCalculo: string;
  observacoesCot: string;
  // Renovação (conditional)
  seguradoraAnterior: string;
  sucursalAnterior: string;
  apoliceAnterior: string;
  coberturaAnterior: string;
  statusApoliceAnterior: string;
  itemApoliceAnterior: string;
  inicioVigenciaAnterior: string;
  fimVigenciaAnterior: string;
  renovacaoMesmoVeiculo: string;
  renovacaoInclusaoCasco: string;
  qtdSinistrosParcialAnterior: string;
  ciApoliceAnterior: string;
  classeBonusAnterior: string;
  comissaoApoliceAnterior: string;
  bonusRenovacaoTodasSeguradoras: string;
  bonusAllianz: string;
  bonusSuhai: string;
  bonusPortoAzulItau: string;
  bonusMapfre: string;
  bonusTokio: string;
  bonusHdi: string;
  bonusBradesco: string;
  bonusYelumAliroIndiana: string;
  // Veículo
  placa: string;
  chassi: string;
  renavam: string;
  marca: string;
  modelo: string;
  anoModelo: string;
  anoFab: string;
  combustivel: string;
  cor: string;
  // Robô Playwright (19/08/2026): só usado quando o portal não infere
  // sozinho pelo consulta de placa — sem valor aqui e o portal exigindo, a
  // cotação falha no robô.
  tipoCambio: string;
  zeroKm: boolean;
  // Só exigidos pelo robô quando zeroKm=true (mapeado em 17/08/2026).
  dataSaidaConcessionaria: string;
  odometro: string;
  alienado: boolean;
  banco: string;
  kmMensal: string;
  // Veículo — uso (espelha a API real da Quiver, ver enumsQuiver.ts)
  tipoUso: string;
  usoTrabalho: string;
  usoEstudo: string;
  usoComercialDoisDias: "sim" | "nao";
  categoriaTaxi: string;
  utilizacaoLocadora: string;
  condutoresQueUtilizam: string;
  cepCirculacao: string;
  // Veículo — dados complementares
  chassiRemarcado: "sim" | "nao";
  leilao: string;
  isencaoImposto: string;
  pcdCnhEspecial: "sim" | "nao";
  valorAdaptacaoPcd: string;
  possuiAntifurtoPorto: "sim" | "nao";
  hdiSegurosBasico: "sim" | "nao";
  antifurto: string;
  antifurtoDetalhes: Record<string, string>;
  // Veículo — blindagem, kit gás, acessórios
  blindagemAtiva: "sim" | "nao";
  coberturaBlindagem: string;
  valorBlindagem: string;
  comFranquiaBlindagem: "sim" | "nao";
  kitGasAtivo: "sim" | "nao";
  coberturaKitGas: "sim" | "nao";
  valorKitGas: string;
  comFranquiaKitGas: "sim" | "nao";
  acessoriosAtivo: "sim" | "nao";
  kitAcessoriosAtivo: "sim" | "nao";
  opcionaisAtivo: "sim" | "nao";
  equipamentosAtivo: "sim" | "nao";
  acessoriosDetalhes: Record<string, string>;
  // Perfil
  condutorMesmo: "sim" | "nao";
  condCpf: string;
  condNome: string;
  condNasc: string;
  condSexo: string;
  condEstadoCivil: string;
  condRelacao: string;
  condNomeSocial: string;
  condTempoHabilitacao: string;
  cepPernoite: string;
  tipoGaragem: string;
  // Perfil — proprietário do veículo
  segProprietario: boolean;
  relacaoComProprietario: string;
  proprietarioTipoPessoa: "Física" | "Jurídica";
  proprietarioCpf: string;
  proprietarioCnpj: string;
  proprietarioNome: string;
  proprietarioNomeSocial: string;
  proprietarioSexo: string;
  proprietarioNascimento: string;
  proprietarioEstadoCivil: string;
  // Perfil — residência e atividade (obrigatório na Quiver p/ uso não-particular)
  tipoResidencia: string;
  tipoAtividadeEmpresa: string;
  ramoAtividade: string;
  profissaoPrincipalCondutor: string;
  seguroCorretorProximo: "sim" | "nao";
  jovens1825: "sim" | "nao";
  // Detalhe por jovem condutor (17-25 anos) — espelha complementares.jovensCondutores
  // da Quiver (ver EXTERNAL_API_GUIDE.md). `nome` é só identificador interno de UX
  // (rótulo da linha), não existe campo de nome no payload do robô para esse array.
  // `idade`/`sexo`/`reside`/`filhoOuFuncionarioPrincipalCondutor` usam os enums
  // exatos do robô (ver enumsPerfil.ts); só `idade` é obrigatória no robô.
  jovens18a25Detalhes: {
    nome: string;
    idade: string;
    sexo: string;
    reside: string;
    filhoOuFuncionarioPrincipalCondutor: string;
  }[];
  // Coberturas
  tipoCobertura: string;
  // Select legado do Passo 4 (Dados do Seguro) com opções
  // (Compreensiva/Casco.../RCF...) que não correspondem ao enum
  // cobertura.plano da Quiver (Fácil/Pleno/Total/Personalizado, usado pelo
  // select do Passo 5 — StepCoberturas.tsx). Antes reaproveitava o mesmo
  // estado `tipoCobertura` e o corrompia. Estado próprio, tela apenas —
  // não persistido nem enviado ao robô hoje.
  categoriaCoberturaLegado: string;
  appMorte: string;
  appInval: string;
  rcfDm: string;
  rcfDc: string;
  // Nível de vidros/faróis/retrovisores — enum de 4 valores do robô
  // (cobertura.vidrosFarosRetrovisores, ver enumsCoberturas.ts). Persistido em
  // `cotacao_coberturas.vidros` (text, migration 20260821010000).
  vidros: string;
  carroReserva: string;
  assist24: string;
  // Coberturas — espelha o protótipo v10 e o objeto `cobertura` da Quiver
  modalidade: string;
  percentualAjuste: string;
  franquiaPrimeiraOpcao: string;
  franquiaSegundaOpcao: string;
  danosMorais: string;
  despesasExtras: string;
  pequenosReparos: boolean;
  // cobertura.valorDeterminado — só enviado à Quiver quando modalidade ===
  // "Valor Determinado". Substitui o par legado casco/cascoValor (nunca
  // enviado, tela órfã — reaproveita a coluna cotacao_coberturas.casco_valor).
  valorDeterminado: string;
};

export type BonusFieldKey =
  | "bonusRenovacaoTodasSeguradoras"
  | "bonusAllianz"
  | "bonusSuhai"
  | "bonusPortoAzulItau"
  | "bonusMapfre"
  | "bonusTokio"
  | "bonusHdi"
  | "bonusBradesco"
  | "bonusYelumAliroIndiana";

export const STEPS = ["Segurado", "Seguro", "Veículo", "Perfil", "Coberturas", "Cálculo"];
export const SEGURADORAS = ["Porto Seguro", "Azul Seguros", "Bradesco Auto", "HDI", "Allianz"];
