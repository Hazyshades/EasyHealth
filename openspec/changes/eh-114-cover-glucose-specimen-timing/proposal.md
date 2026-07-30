## Why

The launch registry currently has only a reviewed serum glucose definition, so generic glucose results can be incorrectly narrowed or cannot represent clinically distinct serum, plasma, whole-blood, urine, fasting, and post-prandial measurements. EH-114 must make glucose identity evidence-driven before these results enter the launch catalog.

## What Changes

- Add reviewed Registry 2.0 glucose measurement definitions for serum, plasma, whole blood, urine, fasting, and post-prandial contexts, preserving each concrete identity separately.
- Require explicit compatible specimen and timing evidence before choosing a concrete glucose definition; retain unknown specimen or timing as a safe `partial` or `ambiguous` outcome without inventing fasting status.
- Review and encode only clinically compatible unit conversions for each numeric glucose definition; keep urine qualitative/dipstick measurements separate from numeric blood measurements.
- Add representative candidate-corpus fixtures and automated verification for positive, missing-evidence, and incompatible-evidence glucose cases.

## Capabilities

### New Capabilities

- `glucose-measurement-resolution`: Evidence-driven selection of distinct reviewed glucose measurement definitions in the Registry 2.0 launch catalog.

### Modified Capabilities

- None.

## Impact

- Registry 2.0 curated definitions and candidate-release corpus artifacts.
- Registry candidate resolution and reviewed-binding runtime helpers.
- Registry verification scripts and roadmap QA checklist for EH-114.
- No database schema, Registry v1 baseline, or external-code mapping is changed without separate clinical review.
