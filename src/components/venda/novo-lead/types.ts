export type Form = {
  // Segurado
  cpf: string;
  pessoa: string;
  nome: string;
  nomeSocial: string;
  nasc: string;
  sexo: string;
  estadoCivil: string;
  celular: string;
  telRes: string;
  email: string;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  sms: "sim" | "nao";
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
  grupoProducao: string;
  campanha: string;
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
  zeroKm: boolean;
  blindado: boolean;
  alienado: boolean;
  banco: string;
  usoComercial: string;
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
  numPassageiros: string;
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
  profissao: string;
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
  jovens18a25Detalhes: { nome: string; idade: string; parentesco: string }[];
  // Coberturas
  tipoCobertura: string;
  casco: string;
  cascoValor: string;
  franquia: string;
  appMorte: string;
  appInval: string;
  dmh: string;
  rcfDm: string;
  rcfDc: string;
  vidros: boolean;
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
  maisAssistencias: boolean;
  maisAssistenciasSeguradora: string;
  // Coberturas — descontos/agravos/comissões por seguradora e condições
  // especiais (não fazem parte do objeto `cobertura` da Quiver — uso
  // interno de negociação com a matriz).
  descontosAgravos: Record<string, Record<string, string>>;
  comissoes: Record<string, string>;
  condicoesEspeciais: {
    worksite: boolean;
    yelumVarejo: boolean;
    planosPopulares: boolean;
  };
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
