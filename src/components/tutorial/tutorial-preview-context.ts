import { createContext, useContext } from "react";
import type { TutorialPreparation } from "./tutorial-types";

export const TutorialPreviewContext = createContext<TutorialPreparation | undefined>(undefined);

export function useTutorialPreview() {
  return useContext(TutorialPreviewContext);
}
