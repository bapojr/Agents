"use client";

import { useEffect, useId, useRef, type ReactNode, type KeyboardEvent } from "react";

export function Popover({ label, open, onOpenChange, trigger, children, className = "", menu = true }: {
  label: string; open: boolean; onOpenChange: (open: boolean) => void;
  trigger: ReactNode; children: ReactNode; className?: string; menu?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const search = useRef({ text: "", time: 0 });

  useEffect(() => {
    if (!open) return;

    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const selected = panel.current?.querySelector<HTMLElement>("[aria-checked=true]") || panel.current?.querySelector<HTMLElement>("button, input");
    selected?.focus();
    selected?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function keyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
      button.current?.focus();
      return;
    }
    if (menu && open && event.key.length === 1 && event.key !== " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      const key = event.key.toLocaleLowerCase();
      search.current = { text: now - search.current.time < 500 ? search.current.text + key : key, time: now };
      const items = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]:not(:disabled)") || []);
      const match = items.find(item => item.textContent?.trim().toLocaleLowerCase().startsWith(search.current.text));
      if (match) { event.preventDefault(); match.focus(); match.scrollIntoView({ block: "nearest" }); }
      return;
    }
    if (!menu || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) { onOpenChange(true); return; }
    const items = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]:not(:disabled)") || []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
    items[next]?.scrollIntoView({ block: "nearest" });
  }

  return <div ref={root} className={`popover ${className}`} onKeyDown={keyDown}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onOpenChange(false); }}>
    <button ref={button} type="button" className="selector" aria-label={label}
      aria-haspopup={menu ? "menu" : "dialog"} aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => onOpenChange(!open)}>{trigger}</button>
    {open && <div ref={panel} id={id} className="popover-panel" role={menu ? "menu" : "dialog"} aria-label={label}
      onClick={(event) => {
        if (menu && (event.target as HTMLElement).closest('[role^="menuitem"]')) button.current?.focus();
      }}>{children}</div>}
  </div>;
}
