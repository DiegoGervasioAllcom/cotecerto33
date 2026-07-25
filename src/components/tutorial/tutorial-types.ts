export type TutorialKind = "sales" | "matriz" | "group";

export type TutorialStep = {
  title: string;
  body: string;
  route?: string;
  target?: string;
  position?: "right" | "left" | "top" | "bottom" | "center";
};

export type TutorialChapter = {
  id: number;
  module: string;
  title: string;
  hook: string;
  duration: string;
  steps: TutorialStep[];
};

export type TutorialDefinition = {
  kind: TutorialKind;
  avatar: string;
  eyebrow: string;
  title: string;
  intro: string;
  chapters: TutorialChapter[];
};
