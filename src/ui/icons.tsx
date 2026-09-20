/**
 * Gezeichnete Symbole.
 *
 * Bewusst selbst gesetzt statt Unicode-Zeichen oder Emoji: eine
 * Strichstärke, ein Raster, ein Stil. Alle Symbole sind 20x20 und laufen auf
 * einem 1.6px-Strich mit runden Enden.
 *
 * Symbole sind immer schmueckend, ausser sie tragen einen Titel. Die
 * Bedeutung steht im Text daneben oder in einem `aria-label` des Elements.
 */

interface IconProps {
  className?: string;
  size?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false as const,
  };
}

export function IconToday({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2.75" y="4.25" width="14.5" height="13" rx="2.25" />
      <path d="M2.75 8.25h14.5M6.75 2.75v3M13.25 2.75v3" />
      <path d="M6.75 12.25h3.5" />
    </svg>
  );
}

export function IconGrid({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2.75" y="3.75" width="14.5" height="13.5" rx="2.25" />
      <path d="M7.5 3.75v13.5M12.5 3.75v13.5M2.75 8.5h14.5" />
    </svg>
  );
}

export function IconTasks({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2.75 5.5l2 2 3-3.5" />
      <path d="M2.75 13.5l2 2 3-3.5" />
      <path d="M10.75 6h6.5M10.75 14h6.5" />
    </svg>
  );
}

export function IconCourses({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.25 4.5A1.75 1.75 0 015 2.75h11.25v11.5H5A1.75 1.75 0 003.25 16V4.5z" />
      <path d="M3.25 16a1.75 1.75 0 001.75 1.25h11.25" />
      <path d="M7 6.25h5.5" />
    </svg>
  );
}

export function IconPlus({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10 4.25v11.5M4.25 10h11.5" />
    </svg>
  );
}

export function IconCheck({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4.25 10.5l3.5 3.5 8-8.5" />
    </svg>
  );
}

export function IconChevronLeft({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12.25 4.75L7 10l5.25 5.25" />
    </svg>
  );
}

export function IconChevronRight({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M7.75 4.75L13 10l-5.25 5.25" />
    </svg>
  );
}

export function IconClose({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function IconNote({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4.25 3.75h8.5l3.25 3.25v9.25a1 1 0 01-1 1h-10.75a1 1 0 01-1-1V4.75a1 1 0 011-1z" />
      <path d="M12.5 3.75V7.5h3.5M6.75 11h6.5M6.75 13.75h4" />
    </svg>
  );
}

export function IconFile({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M11.5 2.75H5.75a1 1 0 00-1 1v12.5a1 1 0 001 1h8.5a1 1 0 001-1V6.75l-4.75-4z" />
      <path d="M11.25 2.75V7h4.25" />
    </svg>
  );
}

export function IconBring({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.25 6.75h13.5v9a1.5 1.5 0 01-1.5 1.5H4.75a1.5 1.5 0 01-1.5-1.5v-9z" />
      <path d="M7 6.75V5.25a3 3 0 016 0v1.5" />
    </svg>
  );
}

export function IconAssessment({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10 2.75l2.2 4.6 5 .7-3.6 3.5.85 4.95L10 14.15l-4.45 2.35.85-4.95L2.8 8.05l5-.7L10 2.75z" />
    </svg>
  );
}

export function IconCovered({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 5.75V10l2.75 1.75" />
    </svg>
  );
}

export function IconSearch({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="8.75" cy="8.75" r="5" />
      <path d="M12.5 12.5l4.25 4.25" />
    </svg>
  );
}

export function IconSettings({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.75v1.9M10 15.35v1.9M3.75 10h1.9M14.35 10h1.9M5.6 5.6l1.35 1.35M13.05 13.05l1.35 1.35M14.4 5.6l-1.35 1.35M6.95 13.05L5.6 14.4" />
    </svg>
  );
}

export function IconCatchUp({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.25 10a6.75 6.75 0 116.75 6.75" />
      <path d="M3.25 10l-.5 3.25M3.25 10l3.25-.5" />
      <path d="M10 6.75V10l2.5 1.5" />
    </svg>
  );
}

export function IconWarning({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10 3.25l7 12.25H3l7-12.25z" />
      <path d="M10 8v3.25M10 13.5v.25" />
    </svg>
  );
}

export function IconTrash({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.75 5.75h12.5M8 5.75V4a1 1 0 011-1h2a1 1 0 011 1v1.75" />
      <path d="M5.5 5.75l.65 10a1 1 0 001 .95h5.7a1 1 0 001-.95l.65-10" />
    </svg>
  );
}

export function IconEdit({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M13.25 3.5l3.25 3.25L7 16.25H3.75V13L13.25 3.5z" />
    </svg>
  );
}

export function IconShare({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="6" cy="10" r="2.25" />
      <circle cx="14.25" cy="5.25" r="2.25" />
      <circle cx="14.25" cy="14.75" r="2.25" />
      <path d="M8 8.9l4.25-2.5M8 11.1l4.25 2.5" />
    </svg>
  );
}

export function IconLock({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4.25" y="8.5" width="11.5" height="8.25" rx="1.5" />
      <path d="M7 8.5V6.25a3 3 0 016 0V8.5" />
    </svg>
  );
}
