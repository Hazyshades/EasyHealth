begin;

-- EH-148: the seam between the report generation service and its own RPC.
--
-- The JSON below was emitted by the real pipeline
-- (`buildReportEvidenceProjection` -> `validateReportContent` ->
-- `prepareDoctorVisitBrief` -> `assertDoctorVisitBrief`), so this fixture is the
-- exact payload `createValidatedReport` sends. Nothing about the RPC contract
-- is hand-tuned to make the test pass.
--
-- Covered: happy-path persistence with evidence mappings, generation-drift and
-- scope fencing, mapping/envelope rejection with no partial row, and the grant
-- boundary that keeps the RPC and the tables unreachable for client roles.

select plan(27);

insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000e1401');

insert into public.documents (
  id, profile_id, storage_path, original_filename, status, document_type,
  file_kind, document_summary, write_generation, lifecycle_state, upload_state
)
values (
  '00000000-0000-4000-8000-0000000e1402',
  '00000000-0000-4000-8000-0000000e1401',
  'eh148/lab-a.pdf',
  'lab-a.pdf',
  'completed',
  'lab_result',
  'pdf',
  'Synthetic fasting glucose panel.',
  0,
  'active',
  'complete'
), (
  '00000000-0000-4000-8000-0000000e1403',
  '00000000-0000-4000-8000-0000000e1401',
  'eh148/lab-b.pdf',
  'lab-b.pdf',
  'completed',
  'lab_result',
  'pdf',
  null,
  0,
  'active',
  'complete'
);

insert into public.observations (id, profile_id, document_id, name, unit, value, observed_at, source_extracted_biomarker_id)
values (
  '00000000-0000-4000-8000-0000000e1411',
  '00000000-0000-4000-8000-0000000e1401',
  '00000000-0000-4000-8000-0000000e1402',
  'Glucose',
  'mmol/L',
  5.4,
  '2026-09-10',
  null
), (
  '00000000-0000-4000-8000-0000000e1412',
  '00000000-0000-4000-8000-0000000e1401',
  '00000000-0000-4000-8000-0000000e1403',
  'Glucose',
  'mmol/L',
  5.8,
  '2026-09-17',
  null
);

-- ── The service payload ────────────────────────────────────────────────────

create function public.eh148_seam_content() returns jsonb language sql immutable as $fn$
select $json$
{
  "schema_version": "eh148.v1",
  "report_kind": "doctor_visit_brief",
  "generated_at": "2026-09-20T08:00:00.000Z",
  "detail_level": "standard",
  "requested_scope": {
    "kind": "explicit",
    "document_ids": [
      "00000000-0000-4000-8000-0000000e1402",
      "00000000-0000-4000-8000-0000000e1403"
    ]
  },
  "source_document_ids": [
    "00000000-0000-4000-8000-0000000e1402",
    "00000000-0000-4000-8000-0000000e1403"
  ],
  "sections": [
    {
      "id": "document_summary",
      "items": [
        { "type": "claim_ref", "claim_id": "claim-document-summary" }
      ]
    },
    {
      "id": "latest_measurements",
      "items": [
        { "type": "claim_ref", "claim_id": "claim-glucose-late" }
      ]
    },
    {
      "id": "changes",
      "items": [
        { "type": "claim_ref", "claim_id": "claim-glucose-early" },
        { "type": "claim_ref", "claim_id": "claim-glucose-late-change" }
      ]
    },
    {
      "id": "clinician_questions",
      "items": [
        { "type": "claim_ref", "claim_id": "question-generated" },
        { "type": "claim_ref", "claim_id": "question-user-6" }
      ]
    },
    { "id": "limitations", "items": [], "empty_state": "no_data" },
    {
      "id": "source_ledger",
      "items": [
        { "type": "source_ref", "source_id": "src_7ca4f583911193b635ea3dbdceb866d4" },
        { "type": "source_ref", "source_id": "src_6dfbd1fc976c6734cfcd010e8d2c69bb" },
        { "type": "source_ref", "source_id": "src_731501faa15aa9357bf3df82469c944c" }
      ]
    }
  ],
  "claims": [
    {
      "id": "claim-glucose-early",
      "section": "changes",
      "kind": "numeric_observation",
      "origin": "generated",
      "factual": true,
      "citations": [
        {
          "source_id": "src_7ca4f583911193b635ea3dbdceb866d4",
          "document_id": "00000000-0000-4000-8000-0000000e1402"
        }
      ],
      "status": "supported",
      "template_id": "numeric_observation_snapshot",
      "template_params": {
        "source_id": "src_7ca4f583911193b635ea3dbdceb866d4",
        "include_range": true
      },
      "text": "glucose.serum.numeric: 5.4 mmol/L (reference range: 3.9–5.5)"
    },
    {
      "id": "claim-glucose-late-change",
      "section": "changes",
      "kind": "numeric_observation",
      "origin": "generated",
      "factual": true,
      "citations": [
        {
          "source_id": "src_6dfbd1fc976c6734cfcd010e8d2c69bb",
          "document_id": "00000000-0000-4000-8000-0000000e1403"
        }
      ],
      "status": "supported",
      "template_id": "numeric_observation_snapshot",
      "template_params": {
        "source_id": "src_6dfbd1fc976c6734cfcd010e8d2c69bb",
        "include_range": true
      },
      "text": "glucose.serum.numeric: 5.8 mmol/L (reference range: 3.9–5.5)"
    },
    {
      "id": "claim-glucose-late",
      "section": "latest_measurements",
      "kind": "source_fact",
      "origin": "generated",
      "factual": true,
      "citations": [
        {
          "source_id": "src_6dfbd1fc976c6734cfcd010e8d2c69bb",
          "document_id": "00000000-0000-4000-8000-0000000e1403"
        }
      ],
      "status": "supported",
      "template_id": "source_fact_snapshot",
      "template_params": {
        "source_id": "src_6dfbd1fc976c6734cfcd010e8d2c69bb",
        "include_date": true
      },
      "text": "glucose.serum.numeric: 5.8 mmol/L (date: 2026-09-17)"
    },
    {
      "id": "claim-document-summary",
      "section": "document_summary",
      "kind": "source_fact",
      "origin": "generated",
      "factual": true,
      "citations": [
        {
          "source_id": "src_731501faa15aa9357bf3df82469c944c",
          "document_id": "00000000-0000-4000-8000-0000000e1402"
        }
      ],
      "status": "supported",
      "template_id": "source_fact_snapshot",
      "template_params": {
        "source_id": "src_731501faa15aa9357bf3df82469c944c",
        "include_date": true
      },
      "text": "Document summary source available (lab_result) (date: 2026-09-10)"
    },
    {
      "id": "question-generated",
      "section": "clinician_questions",
      "kind": "clinician_question",
      "origin": "generated",
      "factual": false,
      "citations": [],
      "status": "supported",
      "question_text": "Which of these results should be repeated before my visit?"
    },
    {
      "id": "question-user-6",
      "section": "clinician_questions",
      "kind": "clinician_question",
      "origin": "user_selected",
      "factual": false,
      "citations": [],
      "status": "supported",
      "question_text": "How should I prepare for the appointment?"
    }
  ],
  "sources": [
    {
      "source_id": "src_7ca4f583911193b635ea3dbdceb866d4",
      "kind": "observation",
      "document_id": "00000000-0000-4000-8000-0000000e1402",
      "snapshot": {
        "kind": "observation",
        "label": "glucose.serum.numeric",
        "observed_at": "2026-09-10",
        "value": 5.4,
        "value_text": "5.4",
        "unit": "mmol/L",
        "ref_low": 3.9,
        "ref_high": 5.5
      }
    },
    {
      "source_id": "src_6dfbd1fc976c6734cfcd010e8d2c69bb",
      "kind": "observation",
      "document_id": "00000000-0000-4000-8000-0000000e1403",
      "snapshot": {
        "kind": "observation",
        "label": "glucose.serum.numeric",
        "observed_at": "2026-09-17",
        "value": 5.8,
        "value_text": "5.8",
        "unit": "mmol/L",
        "ref_low": 3.9,
        "ref_high": 5.5
      }
    },
    {
      "source_id": "src_731501faa15aa9357bf3df82469c944c",
      "kind": "document_summary",
      "document_id": "00000000-0000-4000-8000-0000000e1402",
      "snapshot": {
        "kind": "document_summary",
        "label": "lab-a.pdf",
        "observed_at": "2026-09-10",
        "document_type": "lab_result",
        "summary": "Synthetic fasting glucose panel."
      }
    }
  ],
  "limitations": [],
  "disclaimer": "This is not medical advice. Consult a healthcare professional.",
  "validation": {
    "status": "valid",
    "version": "eh150.v1",
    "issue_codes": []
  },
  "overview": "This brief contains 4 source-backed items from 2 source documents, plus 2 questions for discussion with a healthcare professional."
}
$json$::jsonb;
$fn$;

create function public.eh148_seam_mappings() returns jsonb language sql immutable as $fn$
select $json$
[
  {
    "source_id": "src_7ca4f583911193b635ea3dbdceb866d4",
    "source_kind": "observation",
    "source_row_id": "00000000-0000-4000-8000-0000000e1411",
    "document_id": "00000000-0000-4000-8000-0000000e1402"
  },
  {
    "source_id": "src_6dfbd1fc976c6734cfcd010e8d2c69bb",
    "source_kind": "observation",
    "source_row_id": "00000000-0000-4000-8000-0000000e1412",
    "document_id": "00000000-0000-4000-8000-0000000e1403"
  },
  {
    "source_id": "src_731501faa15aa9357bf3df82469c944c",
    "source_kind": "document_summary",
    "source_row_id": "00000000-0000-4000-8000-0000000e1402",
    "document_id": "00000000-0000-4000-8000-0000000e1402"
  }
]
$json$::jsonb;
$fn$;

create function public.eh148_seam_generations() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    '00000000-0000-4000-8000-0000000e1402', 0::bigint,
    '00000000-0000-4000-8000-0000000e1403', 0::bigint
  );
$$;

create function public.eh148_write_report(
  p_generations jsonb default null,
  p_requested uuid[] default null,
  p_actual uuid[] default null,
  p_content jsonb default null,
  p_mappings jsonb default null,
  p_status text default null
) returns setof public.reports language sql as $fn$
  select public.create_validated_report(
    '00000000-0000-4000-8000-0000000e1401'::uuid,
    'EH-148 writer seam',
    'general_practice'::text,
    'standard'::text,
    'explicit'::text,
    coalesce(
      p_requested,
      array[
        '00000000-0000-4000-8000-0000000e1402'::uuid,
        '00000000-0000-4000-8000-0000000e1403'::uuid
      ]
    ),
    coalesce(
      p_actual,
      array[
        '00000000-0000-4000-8000-0000000e1402'::uuid,
        '00000000-0000-4000-8000-0000000e1403'::uuid
      ]
    ),
    coalesce(p_generations, public.eh148_seam_generations()),
    false,
    coalesce(p_content, public.eh148_seam_content()),
    left(public.eh148_seam_content() ->> 'overview', 120),
    coalesce(p_status, public.eh148_seam_content() -> 'validation' ->> 'status'),
    public.eh148_seam_content() -> 'validation' ->> 'version',
    coalesce(
      array(select jsonb_array_elements_text(public.eh148_seam_content() -> 'validation' -> 'issue_codes')),
      '{}'::text[]
    ),
    coalesce(p_mappings, public.eh148_seam_mappings())
  );
$fn$;

-- ── 1. The service payload is accepted ─────────────────────────────────────

select lives_ok(
  $$ select public.eh148_write_report() $$,
  'the RPC accepts the payload the generation service actually sends'
);

select is(
  (select count(*)::bigint from public.reports
   where profile_id = '00000000-0000-4000-8000-0000000e1401'),
  1::bigint,
  'exactly one report is persisted'
);

select is(
  (select validation_status from public.reports
   where profile_id = '00000000-0000-4000-8000-0000000e1401'),
  'valid',
  'the persisted envelope keeps the validator status'
);

select is(
  (select validation_version from public.reports
   where profile_id = '00000000-0000-4000-8000-0000000e1401'),
  'eh150.v1',
  'the persisted envelope keeps the validator version verbatim'
);

select is(
  (select array_length(requested_document_ids, 1) from public.reports
   where profile_id = '00000000-0000-4000-8000-0000000e1401'),
  2,
  'the typed requested scope is stored as document UUIDs'
);

select is(
  (select array_length(actual_source_document_ids, 1) from public.reports
   where profile_id = '00000000-0000-4000-8000-0000000e1401'),
  2,
  'the exact actual source set is stored alongside the requested scope'
);

select is(
  (select content -> 'validation' ->> 'status' from public.reports
   where profile_id = '00000000-0000-4000-8000-0000000e1401'),
  'valid',
  'the persisted content envelope matches the envelope columns'
);

select is(
  (select count(*)::bigint
   from public.report_evidence_sources
   where report_id in (
     select id from public.reports
     where profile_id = '00000000-0000-4000-8000-0000000e1401'
   )),
  3::bigint,
  'every cited source is persisted as an evidence mapping'
);

select is(
  (select source_kind from public.report_evidence_sources
   where source_id = 'src_731501faa15aa9357bf3df82469c944c'),
  'document_summary',
  'a non-observation source kind keeps its identity in the mapping table'
);

-- ── 2. Source fencing leaves no readable row ───────────────────────────────

select throws_ok(
  $$ select public.eh148_write_report(
       (public.eh148_seam_generations() - '00000000-0000-4000-8000-0000000e1403')
     ) $$,
  'report_source_generation_conflict',
  'a source that advanced its write generation after the snapshot is rejected'
);

select throws_ok(
  $$ select public.eh148_write_report(
       p_requested => array[
         '00000000-0000-4000-8000-0000000e1402'::uuid,
         '00000000-0000-4000-8000-0000000e1403'::uuid,
         '00000000-0000-4000-8000-0000000e1404'::uuid
       ]
     ) $$,
  'report_requested_scope_conflict',
  'a requested scope wider than the materialized source set is rejected'
);

select is(
  (select count(*)::bigint from public.reports
   where profile_id = '00000000-0000-4000-8000-0000000e1401'),
  1::bigint,
  'no rejected candidate left a report or evidence mapping behind'
);

select is(
  (select count(*)::bigint
   from public.report_evidence_sources
   where report_id in (
     select id from public.reports
     where profile_id = '00000000-0000-4000-8000-0000000e1401'
   )),
  3::bigint,
  'rejected candidates add no evidence mappings'
);

-- ── 3. Mapping and envelope rejection ──────────────────────────────────────

select throws_ok(
  $$ select public.eh148_write_report(
       p_mappings => '[{"source_id": "src_7ca4f583911193b635ea3dbdceb866d4", "source_kind": "observation", "source_row_id": "00000000-0000-4000-8000-0000000e1411", "document_id": "00000000-0000-4000-8000-0000000e1402"}]'::jsonb
     ) $$,
  'report_evidence_mapping_incomplete',
  'a mapping set that omits a cited source is rejected'
);

select throws_ok(
  $$ select public.eh148_write_report(p_status => 'invalid') $$,
  'report_validation_envelope_invalid',
  'only a publishable validation status is accepted'
);

select throws_ok(
  $$ select public.eh148_write_report(
       p_content => (public.eh148_seam_content() #- '{validation,status}')
                      || '{"validation": {"status": "limited", "version": "eh150.v1", "issue_codes": []}}'::jsonb
     ) $$,
  'report_validation_envelope_mismatch',
  'a tampered content envelope cannot disagree with the envelope columns'
);

select throws_ok(
  $$ select public.eh148_write_report(
       p_content => jsonb_set(
         public.eh148_seam_content(),
         '{sources,1,snapshot,kind}',
         '"document_summary"'::jsonb
       )
     ) $$,
  'report_source_invalid',
  'a rewritten source snapshot kind is rejected'
);

select throws_ok(
  $$ select public.eh148_write_report(
       p_content => jsonb_set(
         public.eh148_seam_content(),
         '{sections,0,items,0,claim_id}',
         '"claim-glucose-late"'::jsonb
       )
     ) $$,
  'report_claim_reference_invalid',
  'a claim cannot be referenced from a section it does not belong to'
);

-- ── 4. Owner deletion removes the mapping with the report ──────────────────

select lives_ok(
  $$ select public.delete_owner_report(
       '00000000-0000-4000-8000-0000000e1401'::uuid,
       (select id from public.reports
        where profile_id = '00000000-0000-4000-8000-0000000e1401' limit 1)
     ) $$,
  'the owner delete transition removes a validated report'
);

select is(
  (select count(*)::bigint
   from public.report_evidence_sources
   where report_id in (
     select id from public.reports
     where profile_id = '00000000-0000-4000-8000-0000000e1401'
   )),
  0::bigint,
  'evidence mappings cascade with the deleted report'
);

-- ── 5. Only the service role may use the writer ────────────────────────────

set local role service_role;
select throws_ok(
  $$ insert into public.reports (profile_id, title, report_type, detail_level, content, summary_preview)
     values ('00000000-0000-4000-8000-0000000e1401', 'direct', 'general_practice', 'standard', '{}'::jsonb, 'direct') $$,
  'permission denied for table reports',
  'the service role cannot insert reports directly'
);
select lives_ok(
  $$ select public.eh148_write_report() $$,
  'the service role keeps the named validated-create transition'
);
select is(
  (select count(*)::bigint from public.reports
   where profile_id = '00000000-0000-4000-8000-0000000e1401'),
  1::bigint,
  'the service role writes through the transition, not through table DML'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ select public.create_validated_report(
       '00000000-0000-4000-8000-0000000e1401'::uuid,
       'client probe', 'general_practice', 'standard', 'all_eligible',
       null, array['00000000-0000-4000-8000-0000000e1402'::uuid],
       public.eh148_seam_generations(), false,
       public.eh148_seam_content(),
       'probe', 'valid', 'eh150.v1', '{}'::text[],
       public.eh148_seam_mappings()
     ) $$,
  'permission denied for function create_validated_report',
  'an authenticated client cannot call the validated-create transition'
);
reset role;

-- ── 6. A tombstoned source document fences the next write and the old one ──

select lives_ok(
  $$ select public.request_document_deletion(
       '00000000-0000-4000-8000-0000000e1401'::uuid,
       '00000000-0000-4000-8000-0000000e1403'::uuid
     ) $$,
  'the durable deletion transition tombstones the source document'
);

select throws_ok(
  $$ select public.eh148_write_report() $$,
   'report_source_unavailable',
   'a tombstoned source document cannot back a new report'
 );

select is(
  (select count(*)::bigint from public.reports
   where profile_id = '00000000-0000-4000-8000-0000000e1401'
     and invalidated_at is null),
  0::bigint,
  'tombstoning a source document invalidates the report that cited it'
);

rollback;