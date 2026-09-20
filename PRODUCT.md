# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 (App Router), TypeScript (strict), Tailwind v4, IndexedDB via `idb`.
Chosen before init; an existing codebase answers this. Persistence mode was a
user decision: local IndexedDB now, Supabase migrations and adapter prepared
but unverified without credentials.

## What Dock is

Dock is a school organiser for one student's real timetable. School already has
structure; Dock refuses to make the student rebuild it in notes, calendars and
task lists. Every actual lesson is the place where what happened and what needs
doing is kept.

Dock answers four questions:

- **Jetzt:** which lesson am I in?
- **Zuletzt:** what did we do last time?
- **Als Naechstes:** what homework, materials or assessments need attention?
- **Nach einer Abwesenheit:** what did classmates record, and what is still missing?

## Primary user

A student at BG/BRG Tulln, class 7c, in Austria. Confirmed by the user: the
realistic user group for the coming months is **the user plus a few classmates
of 7c**. Onboarding, the invitation flow and catch-up are written for a small
real group, not for a single isolated user and not for a mass audience.

Operating context: a phone in a school corridor between lessons, one-handed,
often in the seconds before a bell. A laptop at a desk in the evening. The
phone case is the one that must feel considered.

## Jobs

- Capture a homework item during a lesson in a few seconds, with the right
  lesson and the right due date already selected.
- See what is now, what is next, and what is overdue, without interpretation.
- Look up what a course covered, weeks back, and find the file that went with it.
- Return after an absence and get the shared record of what was missed, with
  the gaps in that record stated honestly.

## Terminology

The product name is **Dock**. The interface speaks German (de-AT) throughout,
addressing the user as **"Du", without a name**. No display name is stored and
no profile is invented.

Domain terms, as the user says them: Stunde, Stundenplan, Hausuebung,
Behandelt, Mitbringen, Pruefung, Notiz, Datei, Nachholen, Klasse, Privat.
A `Geodreieck` is a set square and never becomes a `Zirkel`.

## Durable constraints

These must survive every future change:

- **German only.** Every user-visible string, including errors, validation,
  accessibility labels, install guidance and demo content. No English fallback,
  no mixed-language screen. Code identifiers stay English.
- **The timetable repeats weekly, forever.** `endsOn = null`, weekly interval 1,
  no occurrence limit, no recurrence opt-in, no expiry at term or year end.
  A missing materialised row means "generate further", never "no more lessons".
- **No rooms.** User decision: rooms appear nowhere — not in the seed, not in
  lesson cards, the grid, the agenda, the detail view or any form. Finding the
  room is not what Dock is for.
- **No teacher information.** Not extracted, stored, displayed or requested.
- **Confirmed times win over the grid.** Monday sports 08:00-10:00 and Tuesday
  KUG 13:40-15:20 are user-confirmed and override the generic period times.
- **Privacy.** Personal notes, completion state and absence selections are never
  visible to classmates or moderators. Absence is never inferred from
  inactivity, location or sensors.
- **Honesty.** Peer confirmation is not school approval. Empty data never reads
  as "nothing happened". Local data is never described as synchronised.
- **Audience and authority are separate axes.** Private/course visibility is
  tracked independently of personal/class origin.

## Scope now

Manual timetable and template review, stable lesson occurrences, Heute, lesson
detail, private notes and files, course history and search, homework with due
rules, Mitbringen, manual assessments, shared entries with revisions and
confirmations and corrections, and catch-up.

## Explicitly out of scope

WebUntis and any external import, iCal, OAuth, scraping, background polling,
AI or OCR or semantic search, payments, push notification infrastructure,
grades or official examination administration, full offline sync, social
features (feeds, followers, DMs, streaks, leaderboards, points), app-store
release, and enterprise administration.

## Evidence and assets

- Source timetable: "Stundenplan – Klasse: 7c, 12. Oktober – 16. Oktober 2026".
  Those dates are provenance only, never the schedule's start or end.
- Design reference: `referencedesign.pdf`, an Atlas marketing page. Its
  composition, typography, spacing and restraint are the reference. Its colours,
  copy, logo, university logos, testimonials, user counts and AI claims are not.
- Supplied fonts (Plain, SF Pro) are kept out of the repository and the build.
  Licence is unestablished; a tuned system stack ships instead.

## Brand commitments

- Wordmark is **"Dock"** set in the display face, no symbol. User decision;
  **a real logo will follow later**, so the wordmark lives in one component and
  the app icon is a clearly provisional placeholder that can be swapped without
  anything depending on it.
- No claim of school endorsement, no "official WebUntis integration", no fake
  testimonials, download badges, affiliation logos, user counts, security or
  compliance badges.

## Accessibility commitments

Keyboard navigation throughout with visible focus; accessible names on every
control; dialog focus management; touch targets of 44px or more; inputs at a
size that does not trigger mobile auto-zoom; adequate contrast; reduced motion
respected. Personal and class content are distinguished by explicit **Privat**
and **Klasse** labels, never by colour alone.

## Open decisions

- The real logo, to be supplied later.
- Full course names for KUG and Labor, clipped in the source document.
- Whether shared mode is ever enabled, which requires a Supabase project.
