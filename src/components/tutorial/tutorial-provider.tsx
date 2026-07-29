import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TutorialChapterEnd } from "./tutorial-chapter-end";
import { tutorialDefinitions } from "./tutorial-content";
import {
  resolveReturnFocusElement,
  restoreTutorialFocus,
  useFocusTrap,
  type ReturnFocusElement,
} from "./tutorial-focus";
import { TutorialOverlay } from "./tutorial-overlay";
import {
  INITIAL_TUTORIAL_PROGRESS,
  readTutorialStoredState,
  tutorialProgressStorageKey,
  type TutorialProgress,
  type TutorialStoredState,
} from "./tutorial-progress";
import type {
  TutorialDefinition,
  TutorialKind,
  TutorialPersona,
  TutorialPreparation,
} from "./tutorial-types";
import { useTutorialStepEngine } from "./use-tutorial-step-engine";

// Mantém o import público já usado pela suíte sem misturar a implementação do foco ao provider.
// eslint-disable-next-line react-refresh/only-export-components
export { restoreTutorialFocus } from "./tutorial-focus";

function readStoredState(
  userId: string,
  kind: TutorialKind,
  definition: TutorialDefinition,
): TutorialStoredState {
  try {
    return readTutorialStoredState(
      localStorage,
      tutorialProgressStorageKey(userId, kind),
      definition,
    );
  } catch {
    return { status: "step", progress: INITIAL_TUTORIAL_PROGRESS };
  }
}
function writeStoredState(userId: string, kind: TutorialKind, state: TutorialStoredState) {
  try {
    localStorage.setItem(tutorialProgressStorageKey(userId, kind), JSON.stringify(state));
  } catch {
    /* armazenamento pode estar indisponível */
  }
}

export function TutorialProvider({
  persona,
  userId,
  returnFocusElement,
  onPreviewChange,
  onClose,
}: {
  persona: TutorialPersona;
  userId: string;
  returnFocusElement: ReturnFocusElement;
  onPreviewChange: (preview: TutorialPreparation | undefined) => void;
  onClose: () => void;
}) {
  const kind = persona.kind;
  const definition = tutorialDefinitions[kind] as TutorialDefinition;
  const saved = useMemo(
    () => readStoredState(userId, kind, definition),
    [userId, kind, definition],
  );
  const savedProgress =
    saved.status === "step"
      ? saved.progress
      : saved.status === "outro"
        ? {
            chapter: saved.chapter,
            step: definition.chapters[saved.chapter].steps.length - 1,
          }
        : INITIAL_TUTORIAL_PROGRESS;
  const [phase, setPhase] = useState<"welcome" | "step" | "outro">(
    saved.status === "outro" ? "outro" : "welcome",
  );
  const [progress, setProgress] = useState<TutorialProgress>(savedProgress);
  const [completed, setCompleted] = useState(saved.status === "completed");
  const current = definition.chapters[progress.chapter]?.steps[progress.step];
  const chapter = definition.chapters[progress.chapter];
  const isLastChapter = progress.chapter === definition.chapters.length - 1;
  const isLastStep = progress.step === chapter.steps.length - 1;

  const persist = useCallback(
    (next: TutorialProgress) => {
      setProgress(next);
      setCompleted(false);
      writeStoredState(userId, kind, { status: "step", progress: next });
    },
    [kind, userId],
  );
  const close = useCallback(() => onClose(), [onClose]);
  const handleMove = useCallback(
    (next: TutorialProgress) => {
      persist(next);
      setPhase("step");
    },
    [persist],
  );
  const { spot, isTransitioning, isTransitionLocked, moveTo } = useTutorialStepEngine({
    active: phase === "step",
    current,
    userId,
    onMove: handleMove,
  });
  const start = useCallback(
    (chapter = progress.chapter, step = progress.step) => {
      moveTo({ chapter, step });
    },
    [moveTo, progress.chapter, progress.step],
  );
  const next = useCallback(() => {
    if (isTransitionLocked()) return;
    const chapter = definition.chapters[progress.chapter];
    if (progress.step + 1 < chapter.steps.length)
      return moveTo({ chapter: progress.chapter, step: progress.step + 1 });
    if (isLastChapter) {
      setCompleted(true);
      writeStoredState(userId, kind, { status: "completed" });
    } else {
      writeStoredState(userId, kind, { status: "outro", chapter: progress.chapter });
    }
    setPhase("outro");
  }, [
    definition.chapters,
    isLastChapter,
    isTransitionLocked,
    kind,
    moveTo,
    progress.chapter,
    progress.step,
    userId,
  ]);
  const previous = useCallback(() => {
    if (isTransitionLocked()) return;
    if (progress.step > 0) {
      moveTo({ chapter: progress.chapter, step: progress.step - 1 });
      return;
    }
    if (progress.chapter > 0) {
      moveTo({
        chapter: progress.chapter - 1,
        step: definition.chapters[progress.chapter - 1].steps.length - 1,
      });
    }
  }, [definition.chapters, isTransitionLocked, moveTo, progress.chapter, progress.step]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (phase === "step" && !isTransitionLocked() && event.key === "ArrowRight") next();
      if (phase === "step" && !isTransitionLocked() && event.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close, isTransitionLocked, next, phase, previous]);

  useEffect(() => {
    onPreviewChange(phase === "step" ? current?.prepare : undefined);
    return () => onPreviewChange(undefined);
  }, [current?.prepare, onPreviewChange, phase]);

  useEffect(() => {
    return () => restoreTutorialFocus(resolveReturnFocusElement(returnFocusElement));
  }, [returnFocusElement]);

  if (phase === "welcome")
    return (
      <Welcome
        definition={definition}
        persona={persona}
        progress={progress}
        completed={completed}
        onStart={start}
        onClose={close}
      />
    );
  if (phase === "outro") {
    return (
      <TutorialChapterEnd
        chapter={chapter}
        isLastChapter={isLastChapter}
        onClose={close}
        onNextChapter={() => moveTo({ chapter: progress.chapter + 1, step: 0 })}
        onShowIndex={() => {
          setProgress(INITIAL_TUTORIAL_PROGRESS);
          if (!completed) {
            writeStoredState(userId, kind, {
              status: "step",
              progress: INITIAL_TUTORIAL_PROGRESS,
            });
          }
          setPhase("welcome");
        }}
      />
    );
  }
  if (!current) return null;
  return (
    <TutorialOverlay
      definition={definition}
      persona={persona}
      step={current}
      progress={progress}
      spot={spot}
      isTransitioning={isTransitioning}
      isLastChapter={isLastChapter}
      isLastStep={isLastStep}
      onPrevious={previous}
      onNext={next}
      onClose={close}
    />
  );
}

function Welcome({
  definition,
  persona,
  progress,
  completed,
  onStart,
  onClose,
}: {
  definition: TutorialDefinition;
  persona: TutorialPersona;
  progress: TutorialProgress;
  completed: boolean;
  onStart: (chapter?: number, step?: number) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(containerRef, startRef);
  const modules = definition.chapters.reduce<
    {
      module: string;
      chapters: { chapter: TutorialDefinition["chapters"][number]; index: number }[];
    }[]
  >((groups, chapter, index) => {
    const currentGroup = groups.at(-1);
    if (currentGroup?.module === chapter.module) {
      currentGroup.chapters.push({ chapter, index });
    } else {
      groups.push({ module: chapter.module, chapters: [{ chapter, index }] });
    }
    return groups;
  }, []);
  return (
    <div
      ref={containerRef}
      className="modal-host"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      tabIndex={-1}
    >
      <div className="tour-welcome">
        <div className="tw-h">
          <div className="ravatar">{persona.avatar}</div>
          <div className="eyebrow">{persona.eyebrow}</div>
          <h2 id="tutorial-title">{persona.title}</h2>
          <p>{persona.intro}</p>
        </div>
        <div className="tw-b">
          <div className="sec-label">ESCOLHA UM CAPÍTULO PARA COMEÇAR</div>
          <div className="modules">
            {modules.map((module) => (
              <div className="mod" key={module.module}>
                <h4>{module.module}</h4>
                {module.chapters.map(({ chapter, index }) => (
                  <button
                    key={chapter.id}
                    type="button"
                    className="chapter"
                    onClick={() => onStart(index, 0)}
                  >
                    <span className="n">{chapter.id}</span>
                    <span className="info">
                      <h5>{chapter.title}</h5>
                      <span className="hk">{chapter.hook}</span>
                    </span>
                    <span className="dur">{chapter.duration}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="tw-f">
          <button type="button" className="skip" onClick={onClose}>
            Agora não
          </button>
          <span className="spc" />
          <button ref={startRef} type="button" className="start" onClick={() => onStart()}>
            {completed
              ? "Começar novamente"
              : `Começar${progress.chapter || progress.step ? " de onde parei" : " do início"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
