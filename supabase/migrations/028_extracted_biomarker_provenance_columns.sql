-- EH-103 follow-up: ensure the denormalized provenance snapshot columns exist on
-- document_extracted_biomarkers (and observation_normalization_revisions).
--
-- Migration 027 aligned the revision store and the `observations` table to the
-- EH-102 launch catalog terminology, but for `document_extracted_biomarkers` it
-- relied solely on renaming the legacy `registry_*` columns `if exists`. When
-- those legacy columns were absent (fresh installs / resets after the v2
-- cutover), the rename branches were skipped and the new columns were never
-- created -- even though GET /api/documents/:id selects them. The running app
-- then fails with:
--   column document_extracted_biomarkers.catalog_manifest_version does not exist
--
-- This migration adds the columns unconditionally (idempotent `add column if not
-- exists`) so the schema matches the intended contract regardless of how the
-- database was bootstrapped. These mirror the provenance columns already added
-- to `observations` in 027.

alter table public.document_extracted_biomarkers
  add column if not exists catalog_manifest_version text,
  add column if not exists catalog_manifest_digest text,
  add column if not exists resolver_version text,
  add column if not exists normalization_version text;

alter table public.observation_normalization_revisions
  add column if not exists catalog_manifest_version text,
  add column if not exists catalog_manifest_digest text,
  add column if not exists resolver_version text,
  add column if not exists normalization_version text;

comment on column public.document_extracted_biomarkers.catalog_manifest_version is
  'EH-102 launch catalog manifest version that participated in resolution.';
comment on column public.document_extracted_biomarkers.catalog_manifest_digest is
  'EH-102 launch catalog manifest digest (sha256) that participated in resolution.';
comment on column public.document_extracted_biomarkers.resolver_version is
  'Resolver schema version that participated in resolution.';
comment on column public.document_extracted_biomarkers.normalization_version is
  'Normalization schema version that participated in resolution.';
