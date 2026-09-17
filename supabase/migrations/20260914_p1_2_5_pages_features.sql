-- ============================================================================
-- P1.2.5 — Tables Pages et Fonctionnalités pour Super Admin
-- ============================================================================

-- Extension pour UUID (déjà présente mais on s'assure)
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLE PAGES
-- ============================================================================
create table public.pages (
  id text primary key,
  name text not null,
  path text not null,
  description text,
  icon text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pages_name_idx on public.pages (name);
create index pages_path_idx on public.pages (path);

-- Trigger pour updated_at (utilise la fonction existante set_updated_at)
create trigger pages_updated_at
before update on public.pages
for each row execute function public.set_updated_at();

-- ============================================================================
-- TABLE FEATURES
-- ============================================================================
create table public.features (
  id text primary key,
  name text not null,
  description text,
  page_id text not null references public.pages (id) on delete cascade,
  category text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index features_page_id_idx on public.features (page_id);
create index features_name_idx on public.features (name);

-- Trigger pour updated_at
create trigger features_updated_at
before update on public.features
for each row execute function public.set_updated_at();

-- ============================================================================
-- TABLE PAGE_FEATURES (table de liaison many-to-many)
-- ============================================================================
create table public.page_features (
  page_id text not null references public.pages (id) on delete cascade,
  feature_id text not null references public.features (id) on delete cascade,
  primary key (page_id, feature_id)
);

create index page_features_page_id_idx on public.page_features (page_id);
create index page_features_feature_id_idx on public.page_features (feature_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.pages enable row level security;
alter table public.features enable row level security;
alter table public.page_features enable row level security;

-- ============================================================================
-- POLITIQUES RLS — PAGES
-- Lecture publique pour utilisateurs authentifiés (comme roles/permissions)
create policy "pages_select_all"
on public.pages for select
to authenticated
using (true);

-- Gestion réservée aux super_admin (et admin pour cohérence)
create policy "pages_manage_super_admin"
on public.pages for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "pages_manage_admin"
on public.pages for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- POLITIQUES RLS — FEATURES
create policy "features_select_all"
on public.features for select
to authenticated
using (true);

create policy "features_manage_super_admin"
on public.features for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "features_manage_admin"
on public.features for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- POLITIQUES RLS — PAGE_FEATURES
create policy "page_features_select_all"
on public.page_features for select
to authenticated
using (true);

create policy "page_features_manage_super_admin"
on public.page_features for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "page_features_manage_admin"
on public.page_features for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- DONNÉES INITIALES — PAGES (correspondant aux routes réelles de l'application)
-- ============================================================================
insert into public.pages (id, name, path, description, icon, is_system) values
  ('dashboard', 'Tableau de bord', '/', 'Page d''accueil après connexion', 'LayoutDashboard', true),
  ('test', 'Évaluation', '/test', 'Passer les batteries de tests', 'ClipboardCheck', true),
  ('results', 'Mes résultats', '/resultats', 'Voir ses propres résultats', 'BarChart2', true),
  ('profile', 'Mon compte', '/compte', 'Profil et préférences personnelles', 'User', true),
  ('password', 'Mot de passe', '/modifier-mot-de-passe', 'Changer son mot de passe', 'Lock', true),
  ('admin-dashboard', 'Admin - Tableau de bord', '/admin', 'Dashboard administrateur (résultats)', 'LayoutDashboard', true),
  ('admin-users', 'Admin - Utilisateurs', '/admin/utilisateurs', 'Gestion des utilisateurs', 'Users', true),
  ('super-admin', 'Super Admin - Dashboard', '/super-admin', 'Back-office global Super Admin', 'Shield', true),
  ('super-admin-accounts', 'Super Admin - Comptes', '/super-admin/comptes', 'Gestion de tous les comptes', 'Users', true),
  ('super-admin-roles', 'Super Admin - Rôles', '/super-admin/roles', 'Gestion des rôles', 'Shield', true),
  ('super-admin-access', 'Super Admin - Accès', '/super-admin/acces', 'Gestion des permissions par rôle', 'Key', true),
  ('super-admin-pages', 'Super Admin - Pages', '/super-admin/pages', 'Gestion des pages accessibles', 'FileText', true),
  ('super-admin-features', 'Super Admin - Fonctionnalités', '/super-admin/fonctionnalites', 'Gestion des fonctionnalités par page', 'Settings', true)
on conflict (id) do nothing;

-- ============================================================================
-- DONNÉES INITIALES — FEATURES (fonctionnalités de base par page)
-- ============================================================================
-- Pages publiques (candidat)
insert into public.features (id, name, description, page_id, category, is_system) values
  ('dashboard-view', 'Voir le tableau de bord', 'Accès au tableau de bord personnel', 'dashboard', 'navigation', true),
  ('test-take', 'Passer le test', 'Accès aux batteries d''évaluation', 'test', 'assessment', true),
  ('test-navigate', 'Naviguer entre batteries', 'Changer de batterie pendant le test', 'test', 'navigation', true),
  ('results-view', 'Voir ses résultats', 'Consultation des résultats personnels', 'results', 'results', true),
  ('results-export', 'Exporter ses résultats', 'Export PDF/JSON des résultats', 'results', 'export', true),
  ('profile-view', 'Voir son profil', 'Consultation des informations personnelles', 'profile', 'profile', true),
  ('profile-edit', 'Modifier son profil', 'Mise à jour des informations personnelles', 'profile', 'profile', true),
  ('password-change', 'Changer son mot de passe', 'Modification du mot de passe', 'password', 'security', true)
on conflict (id) do nothing;

-- Pages Admin
insert into public.features (id, name, description, page_id, category, is_system) values
  ('admin-dashboard-view', 'Voir dashboard admin', 'Accès au tableau de bord administrateur', 'admin-dashboard', 'navigation', true),
  ('admin-results-list', 'Lister les candidats', 'Liste et filtres des candidats', 'admin-dashboard', 'results', true),
  ('admin-results-detail', 'Détail candidat', 'Voir le détail d''un candidat', 'admin-dashboard', 'results', true),
  ('admin-results-export', 'Exporter résultats', 'Export PDF/JSON des résultats candidats', 'admin-dashboard', 'export', true),
  ('admin-results-import', 'Importer résultats', 'Import JSON de résultats candidats', 'admin-dashboard', 'import', true),
  ('admin-users-list', 'Lister utilisateurs', 'Liste et filtres des utilisateurs', 'admin-users', 'users', true),
  ('admin-users-detail', 'Détail utilisateur', 'Voir le détail d''un utilisateur', 'admin-users', 'users', true),
  ('admin-users-edit', 'Modifier utilisateur', 'Modifier profil/statut/rôle utilisateur', 'admin-users', 'users', true),
  ('admin-users-create', 'Créer utilisateur', 'Créer un nouvel utilisateur', 'admin-users', 'users', true),
  ('admin-mode-test', 'Mode test admin', 'Voir les réponses en mode test', 'admin-users', 'test', true)
on conflict (id) do nothing;

-- Pages Super Admin
insert into public.features (id, name, description, page_id, category, is_system) values
  ('super-admin-dashboard-view', 'Voir dashboard Super Admin', 'Accès au tableau de bord Super Admin', 'super-admin', 'navigation', true),
  ('super-admin-stats', 'Statistiques plateforme', 'Voir les statistiques globales', 'super-admin', 'analytics', true),
  ('super-admin-accounts-list', 'Lister tous les comptes', 'Liste complète des utilisateurs', 'super-admin-accounts', 'users', true),
  ('super-admin-accounts-create', 'Créer compte', 'Créer un nouvel utilisateur', 'super-admin-accounts', 'users', true),
  ('super-admin-accounts-edit', 'Modifier compte', 'Modifier rôle/statut/MDP utilisateur', 'super-admin-accounts', 'users', true),
  ('super-admin-roles-list', 'Lister les rôles', 'Voir tous les rôles configurés', 'super-admin-roles', 'roles', true),
  ('super-admin-roles-create', 'Créer rôle', 'Créer un nouveau rôle', 'super-admin-roles', 'roles', true),
  ('super-admin-roles-edit', 'Modifier rôle', 'Modifier nom/description d''un rôle', 'super-admin-roles', 'roles', true),
  ('super-admin-roles-delete', 'Supprimer rôle', 'Supprimer un rôle (hors system)', 'super-admin-roles', 'roles', true),
  ('super-admin-access-view', 'Voir les accès', 'Consulter les permissions par rôle', 'super-admin-access', 'permissions', true),
  ('super-admin-access-edit', 'Modifier les accès', 'Attribuer/retirer permissions aux rôles', 'super-admin-access', 'permissions', true),
  ('super-admin-pages-list', 'Lister les pages', 'Voir toutes les pages gérées', 'super-admin-pages', 'pages', true),
  ('super-admin-pages-create', 'Créer page', 'Créer une nouvelle page', 'super-admin-pages', 'pages', true),
  ('super-admin-pages-edit', 'Modifier page', 'Modifier une page existante', 'super-admin-pages', 'pages', true),
  ('super-admin-pages-delete', 'Supprimer page', 'Supprimer une page (hors system)', 'super-admin-pages', 'pages', true),
  ('super-admin-features-list', 'Lister les fonctionnalités', 'Voir toutes les fonctionnalités', 'super-admin-features', 'features', true),
  ('super-admin-features-create', 'Créer fonctionnalité', 'Créer une nouvelle fonctionnalité', 'super-admin-features', 'features', true),
  ('super-admin-features-edit', 'Modifier fonctionnalité', 'Modifier une fonctionnalité existante', 'super-admin-features', 'features', true),
  ('super-admin-features-delete', 'Supprimer fonctionnalité', 'Supprimer une fonctionnalité (hors system)', 'super-admin-features', 'features', true)
on conflict (id) do nothing;

-- ============================================================================
-- DONNÉES INITIALES — PAGE_FEATURES (liaisons page ↔ fonctionnalité)
-- ============================================================================
-- Pages publiques
insert into public.page_features (page_id, feature_id) values
  ('dashboard', 'dashboard-view'),
  ('test', 'test-take'),
  ('test', 'test-navigate'),
  ('results', 'results-view'),
  ('results', 'results-export'),
  ('profile', 'profile-view'),
  ('profile', 'profile-edit'),
  ('password', 'password-change')
on conflict (page_id, feature_id) do nothing;

-- Pages Admin
insert into public.page_features (page_id, feature_id) values
  ('admin-dashboard', 'admin-dashboard-view'),
  ('admin-dashboard', 'admin-results-list'),
  ('admin-dashboard', 'admin-results-detail'),
  ('admin-dashboard', 'admin-results-export'),
  ('admin-dashboard', 'admin-results-import'),
  ('admin-users', 'admin-users-list'),
  ('admin-users', 'admin-users-detail'),
  ('admin-users', 'admin-users-edit'),
  ('admin-users', 'admin-users-create'),
  ('admin-users', 'admin-mode-test')
on conflict (page_id, feature_id) do nothing;

-- Pages Super Admin
insert into public.page_features (page_id, feature_id) values
  ('super-admin', 'super-admin-dashboard-view'),
  ('super-admin', 'super-admin-stats'),
  ('super-admin-accounts', 'super-admin-accounts-list'),
  ('super-admin-accounts', 'super-admin-accounts-create'),
  ('super-admin-accounts', 'super-admin-accounts-edit'),
  ('super-admin-roles', 'super-admin-roles-list'),
  ('super-admin-roles', 'super-admin-roles-create'),
  ('super-admin-roles', 'super-admin-roles-edit'),
  ('super-admin-roles', 'super-admin-roles-delete'),
  ('super-admin-access', 'super-admin-access-view'),
  ('super-admin-access', 'super-admin-access-edit'),
  ('super-admin-pages', 'super-admin-pages-list'),
  ('super-admin-pages', 'super-admin-pages-create'),
  ('super-admin-pages', 'super-admin-pages-edit'),
  ('super-admin-pages', 'super-admin-pages-delete'),
  ('super-admin-features', 'super-admin-features-list'),
  ('super-admin-features', 'super-admin-features-create'),
  ('super-admin-features', 'super-admin-features-edit'),
  ('super-admin-features', 'super-admin-features-delete')
on conflict (page_id, feature_id) do nothing;

-- ============================================================================
-- GRANT EXECUTE pour les fonctions helper (cohérence avec l'existant)
-- ============================================================================
-- Les fonctions has_role/has_permission ont déjà les grants nécessaires

-- ============================================================================
-- FIN
-- ============================================================================