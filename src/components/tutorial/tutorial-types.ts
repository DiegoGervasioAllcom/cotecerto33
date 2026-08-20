export type TutorialKind = "sales" | "matriz" | "group";

export type TutorialTip = {
  label: string;
  text: string;
};

export type TutorialPreparation =
  | "lead-step-0"
  | "lead-step-1"
  | "lead-step-2"
  | "lead-step-3"
  | "lead-step-4"
  | "lead-ready"
  | "vendas-transmissao"
  | "vendas-emitidas"
  | "vendas-nao-pagas"
  | "acessos-pendentes"
  | "acessos-desligamentos"
  | "acessos-modelos-franquia"
  | "acessos-modelos-master"
  | "proposta-ajuste"
  | "proposta-envio"
  | "aceite-aceita"
  | "aceite-pendencia"
  | "extrato-venda"
  | "extrato-campanha"
  | "extrato-pagamentos";

export type TutorialDestination =
  | "cotacao-comparativo"
  | "proposta-selecionada"
  | "franquia-detalhe"
  | "vendedor-detalhe";

export type TutorialStep = {
  title: string;
  body: string;
  route?: string;
  target?: string;
  position?: "right" | "left" | "top" | "bottom" | "center";
  hook?: string;
  tip?: TutorialTip;
  prepare?: TutorialPreparation;
  destination?: TutorialDestination;
};

export type TutorialOutro = {
  hook: string;
  big?: boolean;
  final?: boolean;
};

export type TutorialChapter = {
  id: number;
  module: string;
  title: string;
  hook: string;
  duration: string;
  steps: TutorialStep[];
  outro: TutorialOutro;
};

export type TutorialDefinition = {
  kind: TutorialKind;
  chapters: TutorialChapter[];
};

export type TutorialPresentation = {
  avatar: string;
  guideName: string;
  eyebrow: string;
  title: string;
  intro: string;
};

export type TutorialPersona = TutorialPresentation & {
  kind: TutorialKind;
};
