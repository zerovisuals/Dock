"use client";

/**
 * Bausteine der Oberfläche.
 *
 * Grundsätze aus den Vorlagen: eine fette Überschrift je Bildschirm, alles
 * andere ruhig. Genau ein Akzent, und zwar auf der Hauptaktion und dem
 * aktiven Feld. Die Hauptaktion sitzt unten über die volle Breite.
 * Abstände folgen der Leiter 4 8 12 16 20 24 32 40 48.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconClose, IconLock, IconShare } from "./icons";

/* -------------------------------------------------------------------------
   Privat / Klasse
   -------------------------------------------------------------------------
   Die Unterscheidung trägt immer Text. Farbe allein genügt nicht.
   ------------------------------------------------------------------------- */

export function AudienceBadge({ audience }: { audience: "privat" | "kurs" }) {
  const privat = audience === "privat";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold"
      style={{
        background: privat ? "var(--surface-sunken)" : "var(--accent-soft)",
        color: privat ? "var(--ink-muted)" : "var(--accent-ink)",
      }}
    >
      {privat ? <IconLock size={12} /> : <IconShare size={12} />}
      {privat ? "Privat" : "Klasse"}
    </span>
  );
}

/* -------------------------------------------------------------------------
   Fachfarbe
   ------------------------------------------------------------------------- */

export function CourseDot({
  color,
  size = 10,
}: {
  color: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
}

/* -------------------------------------------------------------------------
   Leere Zustände
   -------------------------------------------------------------------------
   Ein leerer Bildschirm sagt, was fehlt und was zu tun ist. Er behauptet nie,
   es sei nichts geschehen, nur weil nichts gespeichert ist.
   ------------------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-8">
      <p className="t-title">{title}</p>
      {description && <p className="t-small mt-2 max-w-[42ch]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Segmentierte Auswahl
   ------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="sunken inline-flex w-full gap-1 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className="dock-chip flex-1 rounded-[10px] px-3 text-[0.875rem] font-semibold"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-muted)",
              boxShadow: active ? "var(--shadow-xs)" : undefined,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Auswahl als Chips
   ------------------------------------------------------------------------- */

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className="dock-chip rounded-full px-4 text-[0.8125rem] font-semibold"
            style={{
              background: active ? "var(--surface-contrast)" : "var(--surface)",
              color: active ? "var(--on-contrast)" : "var(--ink-body)",
              boxShadow: active ? "var(--shadow-sm)" : "var(--shadow-xs)",
              opacity: option.disabled ? 0.4 : 1,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Fläche von unten
   -------------------------------------------------------------------------
   Auf dem Telefon fährt sie von unten herein, auf großen Schirmen erscheint
   sie mittig. Die Bewegung zeigt eine tatsächliche Ortsveränderung.
   ------------------------------------------------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? panel)?.focus();

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(11, 15, 20, 0.34)" }}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="dock-sheet relative flex max-h-[92vh] w-full flex-col sm:max-w-[30rem]"
        style={{
          background: "var(--surface)",
          borderRadius: "28px 28px 0 0",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="t-title">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="t-small mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="btn btn-round shrink-0"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6">
          {children}
        </div>

        {footer && (
          <div className="flex flex-col gap-3 px-6 pt-4 pb-6 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Formularfelder
   -------------------------------------------------------------------------
   Ruhig gefüllt. Beim Fokus wird das Feld weiß und bekommt eine farbige
   Kante – so sieht man ohne Suchen, wo man tippt.
   ------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="py-3">
      <label htmlFor={id} className="t-label block">
        {label}
      </label>
      <div className="mt-2">{children({ id, describedBy })}</div>
      {hint && !error && (
        <p id={hintId} className="t-caption mt-2">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="t-caption mt-2"
          style={{ color: "var(--danger)" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = "dock-input w-full px-4 py-3 min-h-[48px] outline-none";

export const inputStyle: React.CSSProperties = {};

/* -------------------------------------------------------------------------
   Hinweisstreifen
   ------------------------------------------------------------------------- */

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  children: ReactNode;
}) {
  const palette = {
    info: { bg: "var(--accent-soft)", fg: "var(--accent-ink)" },
    warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
    danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
    ok: { bg: "var(--ok-soft)", fg: "var(--ok)" },
  }[tone];

  return (
    <p
      className="rounded-[14px] px-4 py-3 text-[0.8125rem] leading-[1.5]"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------
   Speicherzustand
   ------------------------------------------------------------------------- */

export type SaveState = "bereit" | "speichert" | "gespeichert" | "fehler";

export function SaveIndicator({
  state,
  error,
}: {
  state: SaveState;
  error?: string;
}) {
  if (state === "bereit") return null;
  if (state === "speichert") {
    return (
      <span className="t-caption" role="status">
        Wird gespeichert …
      </span>
    );
  }
  if (state === "gespeichert") {
    return (
      <span className="t-caption" role="status" style={{ color: "var(--ok)" }}>
        Gespeichert
      </span>
    );
  }
  return (
    <span className="t-caption" role="alert" style={{ color: "var(--danger)" }}>
      {error ?? "Konnte nicht gespeichert werden."}
    </span>
  );
}

export function LoadingLine({ label = "Wird geladen …" }: { label?: string }) {
  return (
    <p className="t-small px-6 py-10" role="status">
      {label}
    </p>
  );
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
