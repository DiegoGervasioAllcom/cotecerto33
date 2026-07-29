import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";

export function useTutorialWizardPreview(step: number, setStep: Dispatch<SetStateAction<number>>) {
  const tutorialPreview = useTutorialPreview();
  const previewStep =
    tutorialPreview === "lead-ready"
      ? 4
      : tutorialPreview?.startsWith("lead-step-")
        ? Number(tutorialPreview.slice("lead-step-".length))
        : undefined;
  const visibleStep = previewStep ?? step;
  const setVisibleStep = useCallback<Dispatch<SetStateAction<number>>>(
    (next) => {
      if (previewStep === undefined) setStep(next);
    },
    [previewStep, setStep],
  );

  return {
    visibleStep,
    setVisibleStep,
    showTutorialReady: tutorialPreview === "lead-ready",
  };
}
