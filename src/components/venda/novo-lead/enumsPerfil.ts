// Enums do Passo 4 (Perfil) que espelham os valores aceitos pela API real
// de cotação (Quiver — validator case/acento-insensível) e/ou o protótipo
// v10. Fonte: /Users/diego.gervasio/Documents/playwright/src/api/docs/
// openapi.yaml e src/api/validators/cotacao.validator.ts do mesmo projeto.
// Não reordenar/renomear sem checar o validator — a Quiver rejeita
// (HTTP 422) qualquer valor fora dessas listas quando houver enum estrito.

// tipoGaragem: sem enum estrito no validator (busca fuzzy no portal), mas
// só esses 4 valores existem de fato no select real — usar exatamente
// esse texto (inclui o ponto final do 3º valor, que é assim no portal).
export const TIPO_GARAGEM = [
  "Sim, com portão manual",
  "Sim, com portão automático, ou porteiro",
  "Sim, em estacionamento privado pago ou fechado.",
  "Não",
] as const;

// relacaoSeguradoComProprietario: sem enum estrito (texto livre, busca
// fuzzy), mas só esses 15 valores existem no select real do portal.
export const RELACAO_COM_PROPRIETARIO = [
  "Próprio",
  "Ascendentes",
  "Cônjuge",
  "Descendentes, enteado",
  "Empregado",
  "Espólio",
  "Executivo",
  "Irmãos e/ou parentes até 2 grau",
  "Leasing",
  "Sócio",
  "Outros",
  "Própria empresa (PJ)",
  "Empresas do mesmo grupo e quadro societário",
  "Representantes legais da empresa",
  "Alugados (com contrato)",
] as const;

export const ESTADO_CIVIL = [
  "Solteiro(a)",
  "Casado(a)",
  "Viúvo(a)",
  "Divorciado(a)",
  "Separado(a)",
  "União estável",
] as const;

// principalCondutorRelacaoSegurado: texto livre no validator, mas só esses
// 9 valores existem no select real do portal.
export const CONDUTOR_RELACAO = [
  "Conjuge",
  "Pai",
  "Mãe",
  "Filho(a)",
  "Irmão(ã)",
  "Outro(s)",
  "Motorista Particular",
  "Diretor/Sócio/Dirigente",
  "Funcionário/Empregado",
] as const;

// tipoResidencia: enum estrito no validator — os mesmos 6 valores do
// protótipo v10 (ordem do protótipo mantida para fidelidade visual).
export const TIPO_RESIDENCIA = [
  "Casa",
  "Apartamento",
  "Condomínio fechado",
  "Rural",
  "Kitnet",
  "Outros",
] as const;

// tipoAtividadeEmpresa: enum estrito no validator.
export const TIPO_ATIVIDADE_EMPRESA = ["Comércio", "Indústria", "Serviços", "Outros"] as const;

// ramoAtividadeComercialProfissional: enum estrito no validator — 37
// valores. IMPORTANTE: o protótipo v10 tem uma lista própria (RAMO_ATIVIDADE)
// com nomes voltados ao consumidor final (ex.: "Automotivo", "Padaria/
// Confeitaria") que NÃO tem nenhuma correspondência com o enum real da
// Quiver — enviar os valores do protótipo causaria rejeição HTTP 422.
// Por isso a lista abaixo é a do contrato real (openapi.yaml), não a do
// protótipo.
export const RAMO_ATIVIDADE = [
  "Administração pública, defesa e seguridade social",
  "Agricultura, pecuária, produção florestal, pesca e aquicultura",
  "Água, esgoto, atividades de gestão de resíduos de descontaminação",
  "Alojamento e alimentação",
  "Artes, cultura, esportes e educação",
  "Atividades administrativas e serviços complementares",
  "Atividades de organizações associativas",
  "Atividades de vigilância, segurança e investigação",
  "Atividades financeiras, seguros e serviços relacionados",
  "Atividades imobiliárias",
  "Atividades profissionais",
  "Coleta de resíduos",
  "Comércio de combustíveis sólidos, líquidos, gasosos e GLP",
  "Comércio de medicamentos, cigarros e bebidas (exceto água)",
  "Comércio por atacado, varejo e representantes comerciais",
  "Comércio, reparação de veículos automotores e motocicletas",
  "Confecção",
  "Construção/Engenharia",
  "Correio e outras atividades de entrega",
  "Educação",
  "Eletricidade e gás",
  "Fabricação de veículos automotores, reboques, carrocerias e outros equipamentos de transportes",
  "Importação/Exportação",
  "Indústrias de transformação (Fábricas)",
  "Indústrias extrativas",
  "Informação e comunicação",
  "Laticínios",
  "Manutenção, reparação e instalação de máquinas e equipamentos",
  "Metalúrgica, fabricação de produtos de metal (exceto máquinas e equipamentos)",
  "Outras atividades e serviços pessoais",
  "Reparação e manutenção de equipamentos de informática, comunicação e de objetos pessoais",
  "Saúde humana e serviços sociais",
  "Serviços de transporte de passageiros (táxi, escolar, automóveis com motorista, empresa de táxi)",
  "Serviços domésticos",
  "Serviços móveis de atendimento a urgência e remoção de pacientes",
  "Transportadora",
  "Organismos internacionais e outras instituições extraterritoriais",
] as const;

// Substrings usados pelo validator (normalizeText, case/acento-insensível)
// para decidir se relacaoSeguradoComProprietario exige dados do
// proprietário, e se esses dados podem ser Pessoa Jurídica. Replicado aqui
// (não é enum de UI) para o payload da Quiver não violar essas regras.
export const RELACOES_PROPRIETARIO_PF = [
  "conjuge",
  "ascendente",
  "descendente",
  "enteado",
  "irmao",
  "parente",
] as const;
export const RELACOES_PROPRIETARIO_PF_OU_PJ = [
  "empregado",
  "espolio",
  "executivo",
  "socio",
  "outros",
  "propria empresa",
  "empresas do mesmo grupo",
  "representantes legais",
  "alugados",
] as const;
