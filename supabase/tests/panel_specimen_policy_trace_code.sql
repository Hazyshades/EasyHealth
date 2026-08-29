begin;

select plan(3);

create temporary table panel_policy_trace_fixture (name text primary key, trace jsonb);

insert into panel_policy_trace_fixture (name, trace)
values
  (
    'policy_code',
    jsonb_build_object(
      'schemaVersion', '1',
      'outcome', 'resolved',
      'decisionKind', 'single_reviewed_candidate',
      'inputEvidenceHash', repeat('a', 64),
      'catalogManifestVersion', '2026-08-03.0',
      'catalogManifestDigest', repeat('b', 64),
      'resolverVersion', '9',
      'winningCandidateKey', 'hemoglobin_whole_blood',
      'candidates', jsonb_build_array(
        jsonb_build_object(
          'candidateKey', 'hemoglobin_whole_blood',
          'maturity', 'reviewed',
          'score', 68,
          'accepted', jsonb_build_array(
            jsonb_build_object('code', 'alias_exact_match', 'strength', 'strong'),
            jsonb_build_object('code', 'unit_compatible', 'strength', 'strong'),
            jsonb_build_object('code', 'specimen_from_reviewed_panel', 'strength', 'strong')
          ),
          'rejected', '[]'::jsonb,
          'missingAxes', '[]'::jsonb,
          'conflicts', '[]'::jsonb
        )
      ),
      'missingAxes', '[]'::jsonb,
      'conflicts', '[]'::jsonb
    )
  ),
  (
    'legacy_stated',
    jsonb_build_object(
      'schemaVersion', '1',
      'outcome', 'resolved',
      'decisionKind', 'single_reviewed_candidate',
      'inputEvidenceHash', repeat('c', 64),
      'catalogManifestVersion', '2026-08-03.0',
      'catalogManifestDigest', repeat('d', 64),
      'resolverVersion', '8',
      'winningCandidateKey', 'alt_serum_catalytic_activity',
      'candidates', jsonb_build_array(
        jsonb_build_object(
          'candidateKey', 'alt_serum_catalytic_activity',
          'maturity', 'reviewed',
          'score', 61,
          'accepted', jsonb_build_array(
            jsonb_build_object('code', 'alias_normalized_match', 'strength', 'strong'),
            jsonb_build_object('code', 'unit_compatible', 'strength', 'strong'),
            jsonb_build_object('code', 'specimen_compatible', 'strength', 'strong')
          ),
          'rejected', '[]'::jsonb,
          'missingAxes', '[]'::jsonb,
          'conflicts', '[]'::jsonb
        )
      ),
      'missingAxes', '[]'::jsonb,
      'conflicts', '[]'::jsonb
    )
  ),
  (
    'unknown_code',
    jsonb_build_object(
      'schemaVersion', '1',
      'outcome', 'resolved',
      'decisionKind', 'single_reviewed_candidate',
      'inputEvidenceHash', repeat('e', 64),
      'catalogManifestVersion', '2026-08-03.0',
      'catalogManifestDigest', repeat('f', 64),
      'resolverVersion', '9',
      'winningCandidateKey', 'hemoglobin_whole_blood',
      'candidates', jsonb_build_array(
        jsonb_build_object(
          'candidateKey', 'hemoglobin_whole_blood',
          'maturity', 'reviewed',
          'score', 68,
          'accepted', jsonb_build_array(
            jsonb_build_object('code', 'not_a_real_reason_code', 'strength', 'strong')
          ),
          'rejected', '[]'::jsonb,
          'missingAxes', '[]'::jsonb,
          'conflicts', '[]'::jsonb
        )
      ),
      'missingAxes', '[]'::jsonb,
      'conflicts', '[]'::jsonb
    )
  );

select ok(
  public.eh115_validate_resolver_decision_trace(
    (select trace from panel_policy_trace_fixture where name = 'policy_code'),
    '1'
  ),
  'a trace carrying specimen_from_reviewed_panel is accepted'
);

select ok(
  public.eh115_validate_resolver_decision_trace(
    (select trace from panel_policy_trace_fixture where name = 'legacy_stated'),
    '1'
  ),
  'a trace written before the policy existed still validates'
);

select ok(
  not public.eh115_validate_resolver_decision_trace(
    (select trace from panel_policy_trace_fixture where name = 'unknown_code'),
    '1'
  ),
  'an unknown evidence code is still rejected'
);

select * from finish();
rollback;
