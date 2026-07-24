import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { tutorialDefinitions } from "./tutorial-content";
import { INITIAL_TUTORIAL_PROGRESS, readTutorialProgress, type TutorialProgress } from "./tutorial-progress";
import type { TutorialDefinition, TutorialKind, TutorialStep } from "./tutorial-types";

const VERSION = "v10";
const storageKey = (userId: string, kind: TutorialKind) => `cotecerto:tutorial:${VERSION}:${userId}:${kind}`;

function readProgress(userId: string, kind: TutorialKind, definition: TutorialDefinition): TutorialProgress {
  try {
    return readTutorialProgress(localStorage, storageKey(userId, kind), definition);
  } catch {
    return INITIAL_TUTORIAL_PROGRESS;
  }
}
function writeProgress(userId: string, kind: TutorialKind, progress: TutorialProgress) {
  try { localStorage.setItem(storageKey(userId, kind), JSON.stringify(progress)); } catch { /* armazenamento pode estar indisponível */ }
}

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function restoreTutorialFocus(element: HTMLElement | null) {
  element?.focus();
}

function useFocusTrap(containerRef: RefObject<HTMLElement | null>, initialFocusRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    initialFocusRef.current?.focus();
  }, [initialFocusRef]);

  useEffect(() => {
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [containerRef]);
}

export function TutorialProvider({ kind, userId, returnFocusElement, onClose }: { kind: TutorialKind; userId: string; returnFocusElement: HTMLElement | null; onClose: () => void }) {
  const navigate = useNavigate();
  const definition = tutorialDefinitions[kind] as TutorialDefinition;
  const saved = useMemo(() => readProgress(userId, kind, definition), [userId, kind, definition]);
  const [welcome, setWelcome] = useState(true);
  const [progress, setProgress] = useState<TutorialProgress>(saved);
  const [spot, setSpot] = useState<DOMRect | null>(null);
  const current = definition.chapters[progress.chapter]?.steps[progress.step];
  const total = definition.chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);
  const currentNumber = definition.chapters.slice(0, progress.chapter).reduce((sum, chapter) => sum + chapter.steps.length, 0) + progress.step + 1;

  const persist = (next: TutorialProgress) => { setProgress(next); writeProgress(userId, kind, next); };
  const close = () => onClose();
  const start = (chapter = progress.chapter, step = progress.step) => { persist({ chapter, step }); setWelcome(false); };
  const next = () => {
    const chapter = definition.chapters[progress.chapter];
    if (progress.step + 1 < chapter.steps.length) return persist({ chapter: progress.chapter, step: progress.step + 1 });
    if (progress.chapter + 1 < definition.chapters.length) return persist({ chapter: progress.chapter + 1, step: 0 });
    close();
  };
  const previous = () => progress.step > 0 ? persist({ chapter: progress.chapter, step: progress.step - 1 }) : progress.chapter > 0 ? persist({ chapter: progress.chapter - 1, step: definition.chapters[progress.chapter - 1].steps.length - 1 }) : undefined;

  useEffect(() => {
    if (!welcome && current?.route) void navigate({ to: current.route });
  }, [welcome, current?.route, navigate]);

  useLayoutEffect(() => {
    if (welcome || !current) return;
    const place = () => {
      const target = current.target ? document.querySelector(current.target) : null;
      if (target instanceof HTMLElement) { target.scrollIntoView({ block: "center", inline: "center" }); setSpot(target.getBoundingClientRect()); }
      else setSpot(null);
    };
    const timer = window.setTimeout(place, 120);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [welcome, current]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") close(); if (!welcome && event.key === "ArrowRight") next(); if (!welcome && event.key === "ArrowLeft") previous(); };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    return () => restoreTutorialFocus(returnFocusElement);
  }, [returnFocusElement]);

  if (welcome) return <Welcome definition={definition} progress={progress} onStart={start} onClose={close} />;
  if (!current) return null;
  return <Overlay definition={definition} step={current} progress={progress} total={total} number={currentNumber} spot={spot} onPrevious={previous} onNext={next} onClose={close} />;
}

function Welcome({ definition, progress, onStart, onClose }: { definition: TutorialDefinition; progress: TutorialProgress; onStart: (chapter?: number, step?: number) => void; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(containerRef, startRef);
  return <div ref={containerRef} className="modal-host" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" tabIndex={-1}>
    <div className="tour-welcome"><div className="tw-h"><div className="ravatar">{definition.avatar}</div><div className="eyebrow">{definition.eyebrow}</div><h2 id="tutorial-title">{definition.title}</h2><p>{definition.intro}</p></div>
      <div className="tw-b"><div className="sec-label">ESCOLHA UM CAPÍTULO PARA COMEÇAR</div><div className="modules">{definition.chapters.map((chapter, index) => <div className="mod" key={chapter.id}><h4>{chapter.module}</h4><button type="button" className="chapter" onClick={() => onStart(index, 0)}><span className="n">{chapter.id}</span><span className="info"><h5>{chapter.title}</h5><span className="hk">{chapter.hook}</span></span><span className="dur">{chapter.duration}</span></button></div>)}</div></div>
      <div className="tw-f"><button type="button" className="skip" onClick={onClose}>Agora não</button><span className="spc" /><button ref={startRef} type="button" className="start" onClick={() => onStart()}>Começar{progress.chapter || progress.step ? " de onde parei" : " do início"}</button></div>
    </div></div>;
}

function Overlay({ definition, step, progress, total, number, spot, onPrevious, onNext, onClose }: { definition: TutorialDefinition; step: TutorialStep; progress: TutorialProgress; total: number; number: number; spot: DOMRect | null; onPrevious: () => void; onNext: () => void; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(containerRef, closeRef);
  const preferred = step.position ?? "right";
  const style = !spot || preferred === "center" ? { right: 24, bottom: 24 } : preferred === "left" ? { left: Math.max(10, spot.left - 396), top: Math.max(10, spot.top) } : preferred === "top" ? { left: Math.max(10, spot.left), top: Math.max(10, spot.top - 300) } : preferred === "bottom" ? { left: Math.max(10, spot.left), top: spot.bottom + 16 } : { left: spot.right + 16, top: Math.max(10, spot.top) };
  const chapter = definition.chapters[progress.chapter];
  return <div ref={containerRef} className="tour-host active" aria-live="polite" tabIndex={-1}><div className="tour-backdrop" />{spot && <div className="tour-spotlight" style={{ top: spot.top - 8, left: spot.left - 8, width: spot.width + 16, height: spot.height + 16 }} />}
    <div className={`tour-tip pos-${spot ? preferred : "corner"}`} role="dialog" aria-modal="true" aria-labelledby="tutorial-step-title" style={style}><span className="arrow" /><div className="tip-head"><div className="avatar">{definition.avatar}</div><div className="who"><small>CAP. {chapter.id} · {chapter.title}</small><strong>CoteCerto</strong></div><div className="progress">{number} / {total}</div><button ref={closeRef} type="button" className="x" aria-label="Sair do tutorial" onClick={onClose}><X size={16} /></button></div>
      <div className="tip-body"><h4 id="tutorial-step-title">{step.title}</h4><div dangerouslySetInnerHTML={{ __html: step.body }} /></div><div className="tip-foot"><span className="ch">Capítulo {chapter.id} de {definition.chapters.length}</span><span className="spc" /><button type="button" className="prev" disabled={progress.chapter === 0 && progress.step === 0} onClick={onPrevious}><ChevronLeft size={13} />Anterior</button><button type="button" className="exit" onClick={onClose}>Sair</button><button type="button" className="next" onClick={onNext}>{number === total ? "Concluir" : "Próximo"}<ChevronRight size={13} /></button></div>
    </div></div>;
}
