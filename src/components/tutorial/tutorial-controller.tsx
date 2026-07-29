import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  TUTORIAL_TRIGGER_ID,
  TutorialControllerContext,
  type TutorialSession,
} from "./tutorial-controller-context";
import { TutorialPreviewContext } from "./tutorial-preview-context";
import { TutorialProvider } from "./tutorial-provider";
import type { TutorialPreparation } from "./tutorial-types";

export function TutorialControllerProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<TutorialSession | null>(null);
  const [preview, setPreview] = useState<TutorialPreparation>();

  const openTutorial = useCallback((session: TutorialSession) => {
    setActiveSession(session);
  }, []);
  const closeTutorial = useCallback(() => {
    setPreview(undefined);
    setActiveSession(null);
  }, []);
  const resolveReturnFocus = useCallback(() => document.getElementById(TUTORIAL_TRIGGER_ID), []);
  const value = useMemo(
    () => ({ isOpen: activeSession !== null, openTutorial }),
    [activeSession, openTutorial],
  );

  return (
    <TutorialControllerContext.Provider value={value}>
      <TutorialPreviewContext.Provider value={preview}>
        {children}
        {activeSession && (
          <TutorialProvider
            key={`${activeSession.userId}:${activeSession.persona.kind}`}
            persona={activeSession.persona}
            userId={activeSession.userId}
            returnFocusElement={resolveReturnFocus}
            onPreviewChange={setPreview}
            onClose={closeTutorial}
          />
        )}
      </TutorialPreviewContext.Provider>
    </TutorialControllerContext.Provider>
  );
}
