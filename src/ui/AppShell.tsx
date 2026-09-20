"use client";

/**
 * Der Rahmen der App.
 *
 * Telefon: kompakte Kopfzeile, Inhalt, kleine Navigation am unteren Rand mit
 * vier Zielen und einer kontextbezogenen Hinzufügen-Taste. Sichere Bereiche
 * werden berücksichtigt.
 *
 * Grosser Schirm: schmale Seitenspalte, ein fokussierter Inhaltsbereich.
 * Keine große, leere Seitenspalte und keine Begruessung über den halben
 * Bildschirm.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";
import {
  IconCatchUp,
  IconCourses,
  IconGrid,
  IconSettings,
  IconTasks,
  IconToday,
} from "./icons";
import { useDock } from "@/data/DockContext";

interface Destination {
  href: string;
  label: string;
  icon: (props: { size?: number }) => ReactNode;
  primary: boolean;
}

/**
 * Die Ziele sind nach ihrem Inhalt benannt, nicht nach einem Oberbegriff.
 * Nachholen und Einstellungen sind bewusst nicht in der unteren Leiste – sie
 * würden sie ueberfuellen.
 */
const DESTINATIONS: Destination[] = [
  { href: "/app", label: "Heute", icon: IconToday, primary: true },
  { href: "/app/stundenplan", label: "Stundenplan", icon: IconGrid, primary: true },
  { href: "/app/aufgaben", label: "Aufgaben", icon: IconTasks, primary: true },
  { href: "/app/faecher", label: "Fächer", icon: IconCourses, primary: true },
  { href: "/app/nachholen", label: "Nachholen", icon: IconCatchUp, primary: false },
  { href: "/app/einstellungen", label: "Einstellungen", icon: IconSettings, primary: false },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

export function AppShell({
  children,
  action,
}: {
  children: ReactNode;
  /** Kontextbezogene Aktion, je Bildschirm gesetzt. */
  action?: ReactNode;
}) {
  const pathname = usePathname();
  const { previewClock, lastError, clearError } = useDock();

  return (
    <div className="min-h-dvh">
      {/* Die Vorschau-Uhr ist immer ausdruecklich gekennzeichnet. */}
      {previewClock && (
        <div
          className="px-4 py-1.5 text-center text-[0.75rem] font-medium"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          role="status"
        >
          Vorschau-Uhr aktiv – die Zeiten entsprechen nicht der echten Uhrzeit.
        </div>
      )}

      <div className="lg:flex">
        {/* Seitenspalte, nur auf großen Schirmen. */}
        <aside
          className="hidden lg:flex lg:h-dvh lg:w-[228px] lg:shrink-0 lg:flex-col lg:sticky lg:top-0"
          style={{ borderRight: "1px solid var(--line)" }}
        >
          <div className="px-5 py-4">
            <Link href="/app" className="inline-flex rounded">
              <Wordmark />
            </Link>
          </div>
          <nav aria-label="Hauptnavigation" className="flex-1 px-2.5">
            <ul className="space-y-0.5">
              {DESTINATIONS.map((destination) => {
                const active = isActive(pathname, destination.href);
                const Icon = destination.icon;
                return (
                  <li key={destination.href}>
                    <Link
                      href={destination.href}
                      aria-current={active ? "page" : undefined}
                      className="flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 text-[0.875rem]"
                      style={{
                        background: active ? "var(--surface)" : "transparent",
                        color: active ? "var(--ink)" : "var(--ink-muted)",
                        fontWeight: active ? 600 : 500,
                        boxShadow: active ? "var(--shadow-sm)" : undefined,
                      }}
                    >
                      <Icon size={18} />
                      {destination.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <p className="t-caption px-5 py-4">Auf diesem Gerät gespeichert</p>
        </aside>

        {/* Inhalt */}
        <div className="min-w-0 flex-1">
          {/* Kopfzeile nur auf dem Telefon – am Schreibtisch trägt die
              Seitenspalte die Marke. */}
          <header
            className="sticky top-0 z-30 flex min-h-[56px] items-center justify-between gap-3 px-6 pt-safe lg:hidden"
            style={{
              background:
                "color-mix(in srgb, var(--bg) 82%, transparent)",
              backdropFilter: "blur(20px) saturate(140%)",
              WebkitBackdropFilter: "blur(20px) saturate(140%)",
            }}
          >
            <Link
              href="/app"
              className="-ml-1 inline-flex min-h-[44px] items-center rounded px-1"
            >
              <Wordmark />
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/app/nachholen"
                aria-label="Nachholen"
                className="btn btn-round"
              >
                <IconCatchUp size={19} />
              </Link>
              <Link
                href="/app/einstellungen"
                aria-label="Einstellungen"
                className="btn btn-round"
              >
                <IconSettings size={19} />
              </Link>
            </div>
          </header>

          {lastError && (
            <div className="px-6 pt-3 lg:px-10">
              <div
                className="flex items-start justify-between gap-4 rounded-[14px] px-4 py-3"
                style={{ background: "var(--danger-soft)" }}
                role="alert"
              >
                <p className="t-small" style={{ color: "var(--danger)" }}>
                  {lastError}
                </p>
                <button
                  type="button"
                  onClick={clearError}
                  className="t-caption shrink-0 underline"
                  style={{ color: "var(--danger)" }}
                >
                  Schließen
                </button>
              </div>
            </div>
          )}

          <main className="mx-auto w-full max-w-[880px] px-6 pb-40 lg:px-10 lg:pb-16">
            {children}
          </main>
        </div>
      </div>

      {/* Untere Navigation, nur auf dem Telefon. */}
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
        style={{
          background: "color-mix(in srgb, var(--bg) 84%, transparent)",
          backdropFilter: "blur(28px) saturate(150%)",
          WebkitBackdropFilter: "blur(28px) saturate(150%)",
          borderTop: "1px solid var(--line)",
        }}
      >
        <ul className="flex items-stretch justify-around pb-safe">
          {DESTINATIONS.filter((d) => d.primary).map((destination) => {
            const active = isActive(pathname, destination.href);
            const Icon = destination.icon;
            return (
              <li key={destination.href} className="flex-1">
                <Link
                  href={destination.href}
                  aria-current={active ? "page" : undefined}
                  className="relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1"
                  style={{
                    color: active ? "var(--accent)" : "var(--ink-faint)",
                  }}
                >
                  <Icon size={22} />
                  <span
                    className="text-[0.6875rem] leading-none"
                    style={{ fontWeight: active ? 600 : 450 }}
                  >
                    {destination.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Die kontextbezogene Aktion sitzt über der Navigation, in
          Daumenreichweite, und überdeckt sie nicht. */}
      {action && (
        <div
          className="fixed right-4 z-40 lg:hidden"
          style={{ bottom: "calc(var(--bottom-nav-height, 58px) + env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          {action}
        </div>
      )}
    </div>
  );
}

/** Kopf eines Bildschirms: Titel links, Aktionen rechts. */
export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pt-6 pb-4 lg:pt-10">
      <div className="min-w-0">
        <h1 className="t-section">{title}</h1>
        {subtitle && <div className="t-small mt-1.5">{subtitle}</div>}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
