-- ===========================================================================
-- Dock – Grundschema
-- ---------------------------------------------------------------------------
-- Grundsätze:
--   * Jede Einheit hat eine dauerhafte interne Kennung. Datum und Uhrzeit sind
--     veränderliche Eigenschaften, niemals die Identität.
--   * Zielgruppe ("wer darf das sehen") und Herkunft ("wer behauptet das")
--     werden getrennt geführt.
--   * Räume und Lehrpersonen kommen nicht vor. Ausdrückliche Festlegung.
--   * Jede Abfrage ist auf die Zugehörigkeit des Benutzers begrenzt. Die
--     Begrenzung liegt in der Datenbank, nicht nur in der Oberfläche.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Aufzählungen
-- ---------------------------------------------------------------------------

create type lesson_status as enum (
  'geplant', 'entfallen', 'verschoben', 'zusatztermin'
);

create type entry_kind as enum (
  'hausuebung', 'behandelt', 'mitbringen', 'pruefung', 'notiz', 'datei'
);

-- Zielgruppe: wer es sehen darf.
create type audience as enum ('privat', 'kurs');

-- Herkunft: von wem die Aussage stammt. Eine Bestätigung durch Mitschüler
-- ist keine Freigabe durch die Schule.
create type origin as enum ('selbst', 'klasse');

create type due_rule_kind as enum (
  'NEXT_SUBJECT_LESSON', 'SPECIFIC_LESSON', 'FIXED_DATE', 'FIXED_DATETIME', 'NONE'
);

create type due_state as enum ('aufgeloest', 'offen', 'pruefen', 'ohne');

create type membership_role as enum ('mitglied', 'moderation');

create type correction_state as enum ('offen', 'uebernommen', 'abgelehnt');

create type assessment_kind as enum (
  'schularbeit', 'test', 'wiederholung', 'referat', 'mitarbeit', 'sonstiges'
);

-- ---------------------------------------------------------------------------
-- Schule, Jahrgang, Klasse
-- ---------------------------------------------------------------------------

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Vienna',
  locale text not null default 'de-AT',
  created_at timestamptz not null default now()
);

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  starts_on date not null,
  -- Offen, solange kein Ende gesetzt ist. Das ist der Normalfall.
  ends_on date
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null
);

-- ---------------------------------------------------------------------------
-- Kurse und Zugehörigkeit
-- ---------------------------------------------------------------------------

-- Ein Kurs ist eine tatsächliche Unterrichtsgruppe, nicht die Kombination aus
-- Klasse und Fach. Reguläre Mathematik und das Wahlpflichtfach sind zwei
-- Kurse, auch wenn die Namen einander ähneln.
create table courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  display_name text not null,
  source_label text,
  short_label text not null,
  accent text not null,
  elective boolean not null default false,
  unresolved text,
  created_at timestamptz not null default now()
);

-- Eine Gruppe kann Schülerinnen und Schüler aus mehreren Klassen umfassen.
-- Zugehörigkeiten haben Stichtage.
create table memberships (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null default 'mitglied',
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (course_id, user_id, effective_from)
);

create index on memberships (user_id);
create index on memberships (course_id);

-- ---------------------------------------------------------------------------
-- Stundenplan
-- ---------------------------------------------------------------------------

-- Wiederkehrende Vorlage. ends_on bleibt null: der Plan läuft ohne Ende.
create table schedule_series (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  period_indexes smallint[] not null,
  starts_at time not null,
  ends_at time not null,
  effective_from date not null,
  ends_on date,
  interval_weeks smallint not null default 1 check (interval_weeks >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Änderung einer Serie ab einem Stichtag. Die Historie bleibt erhalten.
create table schedule_revisions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references schedule_series(id) on delete cascade,
  effective_from date not null,
  changes jsonb not null,
  note text,
  created_at timestamptz not null default now()
);

-- Eine einzelne, konkrete Stunde. Die Kennung ist dauerhaft; Verschieben oder
-- Entfall ändern Eigenschaften, niemals die Identität.
create table lesson_instances (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  series_id uuid references schedule_series(id) on delete set null,
  -- Schlüssel aus Serie, ursprünglichem Datum und Rasterstunde. Er macht das
  -- Erzeugen wiederholbar.
  occurrence_key text not null unique,
  original_date date not null,
  date date not null,
  starts_at time not null,
  ends_at time not null,
  period_index smallint not null,
  -- Gruppiert zusammenhängende Stunden. Die einzelnen Stunden behalten ihre
  -- Identität.
  block_key text not null,
  status lesson_status not null default 'geplant',
  status_note text,
  source text not null default 'manuell',
  -- Platz für spätere Quellen. Eine fehlende Fremdkennung ist kein Entfall.
  external_ref jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on lesson_instances (course_id, date);
create index on lesson_instances (block_key);

create table schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  label text not null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

-- ---------------------------------------------------------------------------
-- Inhalte
-- ---------------------------------------------------------------------------

create table entries (
  id uuid primary key default gen_random_uuid(),
  kind entry_kind not null,
  course_id uuid not null references courses(id) on delete cascade,
  -- Der Ankerpunkt der Ankündigung ist fest. "Nächste Stunde" wird relativ
  -- dazu aufgelöst, niemals relativ zum heutigen Tag.
  announced_in_lesson_id uuid references lesson_instances(id) on delete set null,
  announced_in_block_key text,
  audience audience not null default 'privat',
  origin origin not null default 'selbst',
  author_id uuid not null references auth.users(id) on delete cascade,
  current_version_id uuid,
  due_rule_kind due_rule_kind,
  due_anchor_lesson_id uuid references lesson_instances(id) on delete set null,
  due_lesson_id uuid references lesson_instances(id) on delete set null,
  due_date date,
  due_time time,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on entries (course_id);
create index on entries (announced_in_lesson_id);

-- Der Wortlaut lebt in Fassungen. Wird ein bestätigter Eintrag geändert,
-- entsteht eine neue Fassung; bisherige Bestätigungen bleiben Historie.
create table entry_versions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  revision integer not null,
  text text not null,
  detail text,
  author_id uuid not null references auth.users(id) on delete cascade,
  change_note text,
  created_at timestamptz not null default now(),
  unique (entry_id, revision)
);

alter table entries
  add constraint entries_current_version_fk
  foreign key (current_version_id) references entry_versions(id)
  deferrable initially deferred;

-- Das festgehaltene Ergebnis der Auflösung, mit Vorgänger und Begründung.
create table due_resolutions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  state due_state not null,
  target_lesson_id uuid references lesson_instances(id) on delete set null,
  target_date date,
  target_time time,
  previous_target_lesson_id uuid references lesson_instances(id) on delete set null,
  previous_target_date date,
  reason text,
  resolved_at timestamptz not null default now()
);

create index on due_resolutions (entry_id, resolved_at desc);

-- Der persönliche Stand. Er gehört der Person, nicht der Aufgabe.
create table user_task_states (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  done boolean not null default false,
  done_at timestamptz,
  -- Die Fassung, die beim Abhaken galt. Wächst der Umfang später, lässt sich
  -- das anzeigen, statt die zusätzliche Arbeit stillschweigend als erledigt
  -- zu führen.
  done_for_version_id uuid references entry_versions(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (entry_id, user_id)
);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  entry_id uuid references entries(id) on delete set null,
  title text not null,
  kind assessment_kind not null default 'test',
  date date,
  time time,
  lesson_id uuid references lesson_instances(id) on delete set null,
  scope text not null default '',
  audience audience not null default 'privat',
  origin origin not null default 'selbst',
  author_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Dateien
-- ---------------------------------------------------------------------------

create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  audience audience not null default 'privat',
  course_id uuid references courses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- Pfad im privaten Ablagefach. Niemals öffentlich.
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- Eine Datei kann zu mehreren Stunden oder zu einer Prüfung gehören. Eine
-- Unterlage auf Kursebene braucht keine willkürlich gewählte Stunde.
create table document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  lesson_id uuid references lesson_instances(id) on delete cascade,
  entry_id uuid references entries(id) on delete cascade,
  assessment_id uuid references assessments(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Geteiltes Klassengedächtnis
-- ---------------------------------------------------------------------------

-- Eine Bestätigung gilt für genau eine Fassung.
create table confirmations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  version_id uuid not null references entry_versions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (version_id, user_id)
);

create table correction_proposals (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  version_id uuid not null references entry_versions(id) on delete cascade,
  proposed_text text not null,
  rationale text,
  author_id uuid not null references auth.users(id) on delete cascade,
  state correction_state not null default 'offen',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Eine Einladung braucht Ablauf und Rücknahme. Das Erraten von "7c" gewährt
-- keinen Zugang.
create table invites (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  max_uses integer not null default 1 check (max_uses >= 1),
  uses integer not null default 0,
  requires_approval boolean not null default true,
  created_at timestamptz not null default now()
);

-- Privat gewählte Zeiträume. Ein Grund wird nicht erfasst. Abwesenheit wird
-- nie aus Inaktivität, Standort oder Sensoren abgeleitet.
create table missed_intervals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

-- ===========================================================================
-- Zugriff
-- ===========================================================================

-- Ist der Benutzer heute Mitglied dieses Kurses?
create or replace function is_course_member(target_course uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from memberships m
    where m.course_id = target_course
      and m.user_id = auth.uid()
      and m.effective_from <= current_date
      and (m.effective_to is null or m.effective_to >= current_date)
  );
$$;

-- Moderiert der Benutzer diesen Kurs? Moderation verwaltet geteilte Inhalte
-- und Mitgliedschaften – sie sieht keine privaten Notizen, keinen
-- persönlichen Stand und keine Abwesenheiten.
create or replace function is_course_moderator(target_course uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from memberships m
    where m.course_id = target_course
      and m.user_id = auth.uid()
      and m.role = 'moderation'
      and m.effective_from <= current_date
      and (m.effective_to is null or m.effective_to >= current_date)
  );
$$;

alter table schools enable row level security;
alter table academic_years enable row level security;
alter table classes enable row level security;
alter table courses enable row level security;
alter table memberships enable row level security;
alter table schedule_series enable row level security;
alter table schedule_revisions enable row level security;
alter table lesson_instances enable row level security;
alter table schedule_exceptions enable row level security;
alter table entries enable row level security;
alter table entry_versions enable row level security;
alter table due_resolutions enable row level security;
alter table user_task_states enable row level security;
alter table assessments enable row level security;
alter table documents enable row level security;
alter table document_links enable row level security;
alter table confirmations enable row level security;
alter table correction_proposals enable row level security;
alter table invites enable row level security;
alter table missed_intervals enable row level security;

-- Kurse: sichtbar für Mitglieder.
create policy courses_select on courses for select
  using (is_course_member(id));

-- Zugehörigkeiten: die eigene, und für Moderation die des Kurses.
create policy memberships_select on memberships for select
  using (user_id = auth.uid() or is_course_moderator(course_id));
create policy memberships_write on memberships for all
  using (is_course_moderator(course_id))
  with check (is_course_moderator(course_id));

-- Stundenplan: sichtbar für Mitglieder des Kurses.
create policy series_select on schedule_series for select
  using (is_course_member(course_id));
create policy revisions_select on schedule_revisions for select
  using (exists (
    select 1 from schedule_series s
    where s.id = schedule_revisions.series_id and is_course_member(s.course_id)
  ));
create policy lessons_select on lesson_instances for select
  using (is_course_member(course_id));

-- Einträge.
--
-- Der entscheidende Teil: ein privater Eintrag ist ausschließlich für seinen
-- Urheber sichtbar. Auch die Moderation sieht ihn nicht.
create policy entries_select on entries for select
  using (
    author_id = auth.uid()
    or (audience = 'kurs' and is_course_member(course_id))
  );

create policy entries_insert on entries for insert
  with check (author_id = auth.uid() and is_course_member(course_id));

-- Ändern darf der Urheber; geteilte Inhalte zusätzlich die Moderation.
create policy entries_update on entries for update
  using (
    author_id = auth.uid()
    or (audience = 'kurs' and is_course_moderator(course_id))
  )
  with check (
    author_id = auth.uid()
    or (audience = 'kurs' and is_course_moderator(course_id))
  );

create policy entries_delete on entries for delete
  using (
    author_id = auth.uid()
    or (audience = 'kurs' and is_course_moderator(course_id))
  );

-- Fassungen folgen der Sichtbarkeit ihres Eintrags.
create policy entry_versions_select on entry_versions for select
  using (exists (
    select 1 from entries e
    where e.id = entry_versions.entry_id
      and (
        e.author_id = auth.uid()
        or (e.audience = 'kurs' and is_course_member(e.course_id))
      )
  ));
create policy entry_versions_insert on entry_versions for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from entries e
      where e.id = entry_versions.entry_id
        and (
          e.author_id = auth.uid()
          or (e.audience = 'kurs' and is_course_moderator(e.course_id))
        )
    )
  );

create policy due_resolutions_select on due_resolutions for select
  using (exists (
    select 1 from entries e
    where e.id = due_resolutions.entry_id
      and (
        e.author_id = auth.uid()
        or (e.audience = 'kurs' and is_course_member(e.course_id))
      )
  ));

-- Der persönliche Stand ist ausschließlich der eigene. Niemand sonst sieht
-- ihn, auch die Moderation nicht.
create policy task_states_own on user_task_states for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy assessments_select on assessments for select
  using (
    author_id = auth.uid()
    or (audience = 'kurs' and is_course_member(course_id))
  );
create policy assessments_write on assessments for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and is_course_member(course_id));

create policy documents_select on documents for select
  using (
    owner_id = auth.uid()
    or (audience = 'kurs' and course_id is not null and is_course_member(course_id))
  );
create policy documents_write on documents for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy document_links_select on document_links for select
  using (exists (
    select 1 from documents d
    where d.id = document_links.document_id
      and (
        d.owner_id = auth.uid()
        or (d.audience = 'kurs' and d.course_id is not null and is_course_member(d.course_id))
      )
  ));

create policy confirmations_select on confirmations for select
  using (exists (
    select 1 from entries e
    where e.id = confirmations.entry_id
      and e.audience = 'kurs'
      and is_course_member(e.course_id)
  ));
create policy confirmations_write on confirmations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy corrections_select on correction_proposals for select
  using (exists (
    select 1 from entries e
    where e.id = correction_proposals.entry_id
      and e.audience = 'kurs'
      and is_course_member(e.course_id)
  ));
create policy corrections_insert on correction_proposals for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from entries e
      where e.id = correction_proposals.entry_id
        and e.audience = 'kurs'
        and is_course_member(e.course_id)
    )
  );

-- Einladungen verwaltet die Moderation der Klasse.
create policy invites_select on invites for select
  using (exists (
    select 1 from courses c
    where c.class_id = invites.class_id and is_course_moderator(c.id)
  ));

-- Gewählte Abwesenheitszeiträume sind ausschließlich privat.
create policy missed_own on missed_intervals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Dateiablage
-- ===========================================================================

-- Privates Fach. Nie öffentlich lesbar.
insert into storage.buckets (id, name, public)
values ('dock-dateien', 'dock-dateien', false)
on conflict (id) do nothing;

create policy dateien_lesen on storage.objects for select
  using (
    bucket_id = 'dock-dateien'
    and exists (
      select 1 from documents d
      where d.storage_path = storage.objects.name
        and (
          d.owner_id = auth.uid()
          or (
            d.audience = 'kurs'
            and d.course_id is not null
            and is_course_member(d.course_id)
          )
        )
    )
  );

create policy dateien_schreiben on storage.objects for insert
  with check (bucket_id = 'dock-dateien' and owner = auth.uid());

create policy dateien_loeschen on storage.objects for delete
  using (bucket_id = 'dock-dateien' and owner = auth.uid());
