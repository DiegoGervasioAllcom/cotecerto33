import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { resolveTutorialDestination } from "./tutorial-destination";
import type { TutorialProgress } from "./tutorial-progress";
import type { TutorialStep } from "./tutorial-types";

const TARGET_WAIT_MS = 1800;

function findTutorialTarget(selector: string) {
  const target = document.querySelector(selector);
  return target instanceof HTMLElement ? target : null;
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForPaint() {
  await nextPaint();
  await nextPaint();
}

function waitForTarget(selector: string, signal: AbortSignal) {
  return new Promise<HTMLElement | null>((resolve) => {
    let settled = false;
    const finish = (target: HTMLElement | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      resolve(target);
    };
    const find = () => {
      const target = findTutorialTarget(selector);
      if (target) finish(target);
    };
    const abort = () => finish(null);
    const observer = new MutationObserver(find);
    const timeout = window.setTimeout(() => finish(null), TARGET_WAIT_MS);

    signal.addEventListener("abort", abort, { once: true });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    find();
  });
}

export function useTutorialStepEngine({
  active,
  current,
  userId,
  onMove,
}: {
  active: boolean;
  current: TutorialStep | undefined;
  userId: string;
  onMove: (progress: TutorialProgress) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [spot, setSpot] = useState<DOMRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionLockRef = useRef(false);

  const moveTo = useCallback(
    (next: TutorialProgress) => {
      if (transitionLockRef.current) return;
      transitionLockRef.current = true;
      setIsTransitioning(true);
      setSpot(null);
      onMove(next);
    },
    [onMove],
  );
  const isTransitionLocked = useCallback(() => transitionLockRef.current, []);

  useEffect(() => {
    if (!active || !current) return;
    const abortController = new AbortController();
    let animationFrame: number | null = null;
    let removePositionListeners = () => {};
    let positionObserver: ResizeObserver | null = null;
    let targetSelector = current.target;

    transitionLockRef.current = true;
    setIsTransitioning(true);
    setSpot(null);

    const measureCurrentTarget = () => {
      if (abortController.signal.aborted) return;
      const target = targetSelector ? findTutorialTarget(targetSelector) : null;
      setSpot(target?.getBoundingClientRect() ?? null);
    };

    const scheduleMeasure = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        measureCurrentTarget();
      });
    };

    const activateStep = async () => {
      try {
        const destination = await resolveTutorialDestination(current, queryClient, {
          userId,
          signal: abortController.signal,
        });
        if (abortController.signal.aborted) return;
        targetSelector = destination.target;
        if (destination.kind === "cotacao") {
          await navigate({ to: "/venda/cotacoes/$id", params: { id: destination.id } });
        } else if (destination.kind === "proposta") {
          await navigate({ to: "/venda/propostas", search: { selected: destination.id } });
        } else if (destination.kind === "franquia") {
          await navigate({ to: "/operacao/franquias/$id", params: { id: destination.id } });
        } else if (destination.kind === "vendedor") {
          await navigate({ to: "/operacao/vendedores/$id", params: { id: destination.id } });
        } else if (destination.route) {
          await navigate({ to: destination.route });
        }
        if (abortController.signal.aborted) return;
        await waitForPaint();
        if (abortController.signal.aborted) return;

        const mountedTarget = targetSelector ? findTutorialTarget(targetSelector) : null;
        const target =
          targetSelector && !mountedTarget
            ? await waitForTarget(targetSelector, abortController.signal)
            : mountedTarget;

        if (target) {
          target.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
          await waitForPaint();
        } else {
          window.scrollTo({ top: 0, behavior: "auto" });
        }
        if (abortController.signal.aborted) return;

        measureCurrentTarget();
        window.addEventListener("resize", scheduleMeasure);
        window.addEventListener("scroll", scheduleMeasure, true);
        removePositionListeners = () => {
          window.removeEventListener("resize", scheduleMeasure);
          window.removeEventListener("scroll", scheduleMeasure, true);
          positionObserver?.disconnect();
        };
        if (typeof ResizeObserver !== "undefined") {
          positionObserver = new ResizeObserver(scheduleMeasure);
          positionObserver.observe(document.body);
          if (target) positionObserver.observe(target);
        }
      } catch {
        removePositionListeners();
        if (!abortController.signal.aborted) setSpot(null);
      } finally {
        if (!abortController.signal.aborted) {
          transitionLockRef.current = false;
          setIsTransitioning(false);
        }
      }
    };

    void activateStep();
    return () => {
      abortController.abort();
      removePositionListeners();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [active, current, navigate, queryClient, userId]);

  return { spot, isTransitioning, isTransitionLocked, moveTo };
}
