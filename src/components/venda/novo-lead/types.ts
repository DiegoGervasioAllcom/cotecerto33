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
  profissao: string;
  cepPernoite: string;
  garagemResid: boolean;
  garagemTrab: boolean;
  garagemEsc: boolean;
  jovens1825: "sim" | "nao";
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
