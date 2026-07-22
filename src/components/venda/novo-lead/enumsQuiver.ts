// Enums do Passo 3 (Veículo) que espelham exatamente os valores aceitos
// pela API real de cotação (Quiver — validator case/acento-insensível).
// Fonte: /Users/diego.gervasio/Documents/playwright/doc/EXTERNAL_API_GUIDE.md
// (seção "Objeto: veiculo") e src/api/validators/cotacao.validator.ts do
// mesmo projeto. Não reordenar/renomear sem checar o validator — a Quiver
// rejeita (HTTP 422) qualquer valor fora dessas listas.

export const TIPO_USO = [
  "Particular",
  "Prestar serviços",
  "Representante comercial/vendas",
  "Táxi",
  "Transporte por aplicativos - Veículo próprio",
  "Transporte comercial de carga",
  "Transporte por aplicativos - Veículo alugado",
  "Ambulância",
  "Auto escola",
  "Bombeiro",
  "Chapa de fábrica",
  "Entrega de Mercadorias",
  "Fins publicitários / Expositor",
  "Frete/Carreto/Mudanças",
  "Funerária",
  "Locadora (Balcão)",
  "Locadora (Contrato)",
  "Lotação com cobrança de passagem",
  "Lotação sem cobrança de passagem",
  "Policiamento / Vigilância / Ronda / Escolta",
  "Test Drive",
  "Transporte de valores",
  "Transporte de funcionários",
  "Transporte de paciente (exceto ambulância)",
  "Escolar",
  "Turismo",
  "Veículos oficiais",
] as const;

export const USO_TRABALHO = [
  "Sim e o mantém em garagem (portão manual)",
  "Sim e o mantém em garagem (portão automático/porteiro)",
  "Sim e o mantém em estacionamento privado, pago ou fechado",
  "Sim, mas o mantém fora de garagem (na rua)",
  "Não utiliza o veículo para se locomover ao local de trabalho",
  "Não trabalha",
] as const;

export const USO_ESTUDO = [
  "Sim e o guarda em garagem (portão manual)",
  "Sim e o guarda em garagem (portão automático/porteiro)",
  "Sim e o guarda em estacionamento privado pago ou fechado",
  "Sim, mas o mantém fora de garagem ('na rua')",
  "Não utiliza o veículo para se locomover ao local de estudo",
  "Não estuda",
] as const;

export const CATEGORIA_TAXI = [
  "Comum",
  "Comum com ponto privado",
  "Comum rádio táxi",
  "Especial rádio táxi",
  "Luxo",
] as const;

export const UTIL_LOCADORA = [
  "Transporte de funcionários",
  "Táxi",
  "Lotação - Com cobrança de passagem",
  "Lotação - Sem cobrança de passagem",
  "Turismo",
  "Prestação de serviços",
  "Representação Comercial/Vendas",
  "Transporte de carga",
] as const;

export const ISENCAO_IMPOSTO = [
  "Sem isenção",
  "ICMS",
  "IPI",
  "ICMS e IPI",
  "Outros",
  "Frotista",
] as const;

export const CONDUTORES_QUE_UTILIZAM = [
  "É utilizado por um único condutor",
  "É utilizado por dois condutores",
  "É utilizado por três condutores",
] as const;

export const ANTIFURTO_TIPOS = [
  "Não",
  "Alarme Sonoro",
  "Bloqueador",
  "Rastreador",
  "Dispositivos comuns",
] as const;

// tipoUso que exige condutoresQueUtilizam (Cobertura7998) quando visível no portal.
export const TIPOS_USO_COM_CONDUTORES = [
  "Transporte por aplicativos - Veículo próprio",
  "Transporte de funcionários",
] as const;

// Campo só do protótipo v10 — sem contrapartida na Quiver hoje (não existe
// no validator nem no guia). Mantido por decisão do usuário para fidelidade
// visual; não é enviado em montarPayloadQuiver() até a Quiver suportar.
export const LEILAO = [
  "Não possui histórico de leilão",
  "Leilão de indenização integral",
  "Outros tipos de leilão (administrativa, financeira, renovação de frota, etc.)",
] as const;
