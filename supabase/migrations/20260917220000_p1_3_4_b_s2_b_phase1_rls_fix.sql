-- ============================================================================
-- P1.3.4-B-S2-B-PHASE1-RLS-FIX — Correction RLS role_permissions écriture
-- ============================================================================
-- Supprime les policies INSERT/UPDATE/DELETE permettant le bypass des RPC sécurisées
-- Conserve SELECT pour super_admin (debug/admin UI)
-- Les mutations passent obligatoirement par grant_role_permission() / revoke_role_permission()

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. SUPPRESSION POLICIES INSERT/UPDATE/DELETE
-- ============================================================================

-- Policy admin (permet à tout admin d'écrire directement - BYPASS CRITIQUE)
drop policy if exists "role_permissions_manage_admin" on public.role_permissions;

-- Policy super_admin (permet à tout super_admin d'écrire directement - BYPASS CRITIQUE)
drop policy if exists "role_permissions_manage_super_admin" on public.role_permissions;

-- ============================================================================
-- FIN CORRECTION RLS
-- ============================================================================