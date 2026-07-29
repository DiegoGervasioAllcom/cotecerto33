import { createContext, useContext } from "react";
import type { TutorialPersona } from "./tutorial-types";

export const TUTORIAL_TRIGGER_ID = "btnTutorial";

export type TutorialSession = {
  persona: TutorialPersona;
  userId: string;
};

export type TutorialControllerValue = {
  isOpen: boolean;
  openTutorial: (session: TutorialSession) => void;
};

export const TutorialControllerContext = createContext<TutorialControllerValue | null>(null);

export function useTutorialController() {
  const value = useContext(TutorialControllerContext);
  if (!value) {
    throw new Error("useTutorialController deve ser usado dentro de TutorialControllerProvider");
  }
  return value;
}
