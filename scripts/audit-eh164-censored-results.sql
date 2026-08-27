-- EH-164 read-only audit: comparator/threshold results stored as invented
-- numbers, or with a comparator occupying the modifier clinical axis.
-- Operator snapshot only. No UPDATE, DELETE, or schema change.

SELECT
  'document_extracted_biomarkers'::text AS source_table,
  e.id,
  e.document_id,
  e.profile_id,
  e.raw_name AS printed_name,
  e.value_numeric,
  e.value_text,
  e.raw_value_text,
  e.value_kind,
  e.modifier
FROM public.document_extracted_biomarkers e
WHERE
  COALESCE(e.value_text, '') ~ '[<>≤≥]'
  OR COALESCE(e.raw_value_text, '') ~ '[<>≤≥]'
  OR e.modifier IN (
    '<', '>', '<=', '>=', '≤', '≥',
    'less than', 'greater than', 'less_than', 'greater_than'
  )

UNION ALL

SELECT
  'observations'::text AS source_table,
  o.id,
  o.document_id,
  o.profile_id,
  o.name AS printed_name,
  o.value AS value_numeric,
  o.value_text,
  o.raw_value_text,
  o.value_kind,
  o.modifier
FROM public.observations o
WHERE
  o.observation_kind = 'lab'
  AND (
    COALESCE(o.value_text, '') ~ '[<>≤≥]'
    OR COALESCE(o.raw_value_text, '') ~ '[<>≤≥]'
    OR o.modifier IN (
      '<', '>', '<=', '>=', '≤', '≥',
      'less than', 'greater than', 'less_than', 'greater_than'
    )
  )

ORDER BY source_table, id;
