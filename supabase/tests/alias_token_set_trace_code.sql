begin;

select plan(5);

-- #105: the EH-115 trace validator must accept the new order-insensitive alias
-- reason code, must keep accepting traces written before it existed, and must
-- still reject anything outside the allowlist.

create temporary table alias_token_set_fixture (name text primary key, trace jsonb);

insert into alias_token_set_fixture (name, trace)
values
  (
    'token_set',
    jsonb_build_object(
      'schemaVersion', '1',
      'outcome', 'resolved',
      'decisionKind', 'single_reviewed_candidate',
      'inputEvidenceHash', repeat('a', 64),
      'catalogManifestVersion', '2026-08-03.0',
      'catalogManifestDigest', repeat('b', 64),
      'resolverVersion', '9',
      'winningCandidateKey', 'alt_serum_catalytic_activity',
      'candidates', jsonb_build_array(
        jsonb_build_object(
          'candidateKey', 'alt_serum_catalytic_activity',
          'maturity', 'reviewed',
          'score', 57,
          'accepted', jsonb_build_array(
            jsonb_build_object('code', 'alias_token_set_match', 'strength', 'strong'),
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
    'legacy_normalized',
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
            jsonb_build_object('code', 'unit_compatible', 'strength', 'strong')
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
      'winningCandidateKey', 'alt_serum_catalytic_activity',
      'candidates', jsonb_build_array(
        jsonb_build_object(
          'candidateKey', 'alt_serum_catalytic_activity',
          'maturity', 'reviewed',
          'score', 57,
          'accepted', jsonb_build_array(
            jsonb_build_object('code', 'alias_vibes_match', 'strength', 'strong')
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
    (select trace from alias_token_set_fixture where name = 'token_set'),
    '1'
  ),
  'a trace carrying alias_token_set_match is accepted'
);

select ok(
  public.eh115_validate_resolver_decision_trace(
    (select trace from alias_token_set_fixture where name = 'legacy_normalized'),
    '1'
  ),
  'a trace written under resolver version 8 stays valid after the allowlist widens'
);

select ok(
  not public.eh115_validate_resolver_decision_trace(
    (select trace from alias_token_set_fixture where name = 'unknown_code'),
    '1'
  ),
  'an evidence code outside the allowlist is still rejected'
);

-- The widening must not have relaxed anything else in the validator.
select ok(
  not public.eh115_validate_resolver_decision_trace(
    (select trace from alias_token_set_fixture where name = 'token_set') - 'conflicts',
    '1'
  ),
  'a trace missing a required top-level key is still rejected'
);

select ok(
  not public.eh115_validate_resolver_decision_trace(
    (select trace from alias_token_set_fixture where name = 'token_set'),
    '2'
  ),
  'an unrecognized trace schema version is still rejected'
);

select * from finish();

rollback;
