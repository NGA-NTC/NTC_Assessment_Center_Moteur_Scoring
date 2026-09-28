-- ============================================================================
-- P3-S8 : Persistance Supabase des réponses du questionnaire
-- Source de vérité : assessment_attempts (1 par user_id + assessment_id)
--                     assessment_responses (1 par attempt_id + question_id)
-- À appliquer dans le SQL Editor du projet Supabase (sonylnjcekfxdnhmfkll).
-- Idempotent : réexécutable sans erreur.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. assessment_attempts — une tentative par couple (user_id, assessment_id)
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  assessment_id      text not null,
  status             text not null default 'in_progress'
                     check (status in ('in_progress', 'completed', 'abandoned')),
  current_question_id text,
  started_at         timestamptz not null default now(),
  last_activity_at   timestamptz not null default now(),
  completed_at       timestamptz
);

-- Unicité fonctionnelle : une seule tentative par couple user + assessment.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_attempts_user_assessment_unique'
  ) then
    alter table public.assessment_attempts
      add constraint assessment_attempts_user_assessment_unique
      unique (user_id, assessment_id);
  end if;
end $$;

create index if not exists assessment_attempts_user_id_idx
  on public.assessment_attempts (user_id);
create index if not exists assessment_attempts_assessment_idx
  on public.assessment_attempts (assessment_id);

-- ---------------------------------------------------------------------------
-- 2. assessment_responses — une réponse par (attempt_id, question_id)
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_responses (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id  text not null,
  answer       jsonb not null,
  answered_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Contrainte unique exigée : (attempt_id, question_id) — garantit l'upsert
-- et interdit les doublons de réponses pour une même question.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_responses_attempt_question_unique'
  ) then
    alter table public.assessment_responses
      add constraint assessment_responses_attempt_question_unique
      unique (attempt_id, question_id);
  end if;
end $$;

create index if not exists assessment_responses_attempt_id_idx
  on public.assessment_responses (attempt_id);

-- updated_at automatique sur les réponses (réutilisation du pattern existant
-- si le trigger générique est déjà présent).
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create function public.set_updated_at() returns trigger
    language plpgsql as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'assessment_responses_set_updated_at'
  ) then
    create trigger assessment_responses_set_updated_at
      before update on public.assessment_responses
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. RLS — un candidat accède à SES tentatives/réponses ; les administrateurs
--    (rôles « Administrateur » / « Super Administrateur » dans user_roles/roles,
--    schéma existant du projet) peuvent lire les données nécessaires à Résultats.
--    Aucun accès anonyme : tables fermées par défaut (RLS activé, no policy = deny).
-- ---------------------------------------------------------------------------
alter table public.assessment_attempts  enable row level security;
alter table public.assessment_responses enable row level security;

-- Nettoyage idempotent des policies de la phase (réexécution propre).
drop policy if exists attempts_select_own   on public.assessment_attempts;
drop policy if exists attempts_insert_own   on public.assessment_attempts;
drop policy if exists attempts_update_own   on public.assessment_attempts;
drop policy if exists attempts_delete_own   on public.assessment_attempts;
drop policy if exists attempts_admin_read   on public.assessment_attempts;
drop policy if exists responses_select_own  on public.assessment_responses;
drop policy if exists responses_insert_own  on public.assessment_responses;
drop policy if exists responses_update_own  on public.assessment_responses;
drop policy if exists responses_delete_own  on public.assessment_responses;
drop policy if exists responses_admin_read  on public.assessment_responses;

-- --- Candidat : ses propres tentatives -------------------------------------
create policy attempts_select_own on public.assessment_attempts
  for select to authenticated
  using (user_id = auth.uid());

create policy attempts_insert_own on public.assessment_attempts
  for insert to authenticated
  with check (user_id = auth.uid());

create policy attempts_update_own on public.assessment_attempts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy attempts_delete_own on public.assessment_attempts
  for delete to authenticated
  using (user_id = auth.uid());

-- --- Candidat : ses propres réponses (via sa tentative) --------------------
create policy responses_select_own on public.assessment_responses
  for select to authenticated
  using (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

create policy responses_insert_own on public.assessment_responses
  for insert to authenticated
  with check (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

create policy responses_update_own on public.assessment_responses
  for update to authenticated
  using (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

create policy responses_delete_own on public.assessment_responses
  for delete to authenticated
  using (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

-- --- Administrateur : lecture seule (nécessaire à Résultats) ---------------
create policy attempts_admin_read on public.assessment_attempts
  for select to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name in ('Administrateur', 'Super Administrateur')
    )
  );

create policy responses_admin_read on public.assessment_responses
  for select to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name in ('Administrateur', 'Super Administrateur')
    )
  );

-- NB : pas de policy admin en écriture (insert/update/delete) : les admins
-- consultent les résultats mais n'écrivent jamais les réponses d'un candidat.

-- ---------------------------------------------------------------------------
-- 4. SERVICE ROLE HELPER (optionnel, backfill/outil d'exploitation) :
--    pour la migration des anciennes données locales, utiliser la clé
--    service_role côté outil d'exploitation (jamais côté front), qui
--    contourne la RLS par définition.
-- ---------------------------------------------------------------------------

-- Fin de migration P3-S8.
