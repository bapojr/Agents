"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

const storageKey = "agents-reference-panel-width";

export function usePanelResize(workspace: RefObject<HTMLElement | null>) {
  const [layout, setLayout] = useState({ width: 0, min: 0, max: 0, compact: false, ready: false });
  const [dragging, setDragging] = useState(false);
  const preferred = useRef<number | null>(null);
  const current = useRef(layout);
  const drag = useRef<{ pointer: number; x: number; width: number } | null>(null);
  const measure = useRef<() => void>(() => {});
  const step = useRef(8);

  useLayoutEffect(() => {
    const element = workspace.current;
    if (!element) return;
    try {
      const stored = localStorage.getItem(storageKey);
      const value = stored === null ? NaN : Number(stored);
      if (Number.isFinite(value) && value > 0) preferred.current = value;
    } catch { /* Resizing still works when storage is unavailable. */ }
    const styles = getComputedStyle(element);
    const token = (name: string) => parseFloat(styles.getPropertyValue(name));
    const min = token("--pp-panel-min-width");
    const screenRatio = token("--pp-panel-max-screen-ratio");
    const chatMin = token("--pp-answer-min-width");
    const divider = token("--pp-s8");
    step.current = divider;
    measure.current = () => {
      const available = element.getBoundingClientRect().width;
      const max = Math.max(min, Math.floor(Math.min(window.innerWidth * screenRatio, available - chatMin - divider)));
      const compact = window.matchMedia("(max-width: 900px)").matches || available < min + chatMin + divider;
      const width = Math.round(Math.max(min, Math.min(max, preferred.current ?? (available - divider) / 2.35)));
      const next = { width, min, max, compact, ready: true };
      current.current = next;
      setLayout(next);
    };
    measure.current();
    const observer = new ResizeObserver(() => measure.current());
    observer.observe(element);
    return () => observer.disconnect();
  }, [workspace]);

  const setWidth = (requested: number, persist = false) => {
    const bounds = current.current;
    const width = Math.round(Math.max(bounds.min, Math.min(bounds.max, requested)));
    current.current = { ...bounds, width };
    setLayout(current.current);
    if (persist) {
      preferred.current = width;
      try { localStorage.setItem(storageKey, String(width)); } catch { /* Session-only preference. */ }
    }
  };
  const reset = () => {
    preferred.current = null;
    try { localStorage.removeItem(storageKey); } catch { /* Session-only preference. */ }
    measure.current();
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const started = drag.current;
    if (!started || event.pointerId !== started.pointer) return;
    drag.current = null;
    setDragging(false);
    setWidth(cancel ? started.width : current.current.width, !cancel);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && drag.current) {
      const started = drag.current;
      drag.current = null;
      setDragging(false);
      setWidth(started.width);
      if (event.currentTarget.hasPointerCapture(started.pointer)) event.currentTarget.releasePointerCapture(started.pointer);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const delta = step.current * (event.shiftKey ? 4 : 1);
    const requested = event.key === "ArrowLeft" ? current.current.width + delta
      : event.key === "ArrowRight" ? current.current.width - delta
      : event.key === "Home" ? current.current.min
      : event.key === "End" ? current.current.max : null;
    if (requested === null) return;
    event.preventDefault();
    setWidth(requested, true);
  };

  return {
    ...layout,
    dragging,
    style: (layout.ready ? { "--reference-panel-width": `${layout.width}px` } : {}) as CSSProperties,
    separatorProps: {
      onKeyDown,
      onDoubleClick: reset,
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || !event.isPrimary || current.current.compact) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointer: event.pointerId, x: event.clientX, width: current.current.width };
        setDragging(true);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const started = drag.current;
        if (started && event.pointerId === started.pointer) setWidth(started.width + started.x - event.clientX);
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => endDrag(event),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => endDrag(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => endDrag(event, true),
    },
  };
}
