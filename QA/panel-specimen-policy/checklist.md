[checklist.md#DE47]
1:# Panel specimen policy: recover CBC identity from a reviewed heading rule
2:
3:**Roadmap status:** Implementation complete; awaiting PR merge and Wiki publish
4:**Build / environment:** local EasyHealth app + processed synthetic lab PDF
5:**Test run date:** `2026-08-29`
6:**Tester:** local agent run
7:
8:Related: GitHub issue #111, OpenSpec `add-reviewed-panel-specimen-policy`.
9:
10:## What this checklist covers
11:
12:After #106, a laboratory report that never prints "serum" or "whole blood" stays unmatched even when the printed panel heading is a complete blood count. This change does **not** ask the reviewer to pick a specimen. A reviewed catalog rule supplies whole blood for CBC constituents when the captured heading matches. Biochemistry rows stay unmatched.
13:
14:## Before you start
15:
16:- [ ] Use a dedicated test account.
17:- [ ] Use only synthetic or de-identified documents.
18:- [ ] Confirm processing has finished unless the check tests processing.
19:- [ ] Prefer a **new upload**. Reprocess alone does not recapture headings on old rows.
20:
21:## Test data
22:
23:| ID | Test document or setup | Purpose |
24:| --- | --- | --- |
25:| `PSP-01` | Synthetic English mock lab PDF with headings `Complete blood count with manual smear microscopy + ESR` and `Biochemistry and inflammation`, no printed specimen words | Normal recovery path |
26:| `PSP-02` | Same file after **Reprocess** without re-extraction, on a document processed before heading capture | Old rows are not silently upgraded |
27:| `PSP-03` | Synthetic report that prints `Material: serum` on a haemoglobin line under a CBC heading | Stated specimen wins |
28:
29:## Interface checks
30:
31:### PSP-UI-01: CBC rows return to matched measurement
32:
33:**Precondition:** `PSP-01` is processed with the current extraction version and is open in **Documents**.
34:
35:1. Go to **Documents**.
36:2. Open `PSP-01`.
37:3. Open **Extracted biomarkers**.
38:4. Find a haemoglobin (or other CBC) row that has no printed specimen on the line.
39:
40:**Expected result:** The row shows a matched whole-blood measurement. The reviewer is not asked to choose a specimen.
41:
42:**Result:** `Pass | Fail | Blocked | N/A`
43:
44:### PSP-UI-02: Biochemistry stays unmatched
45:
46:**Precondition:** Same document as PSP-UI-01.
47:
48:1. Find ALT, glucose, or another biochemistry row under `Biochemistry and inflammation`.
49:
50:**Expected result:** The row stays incomplete because specimen is missing. The heading alone does not create a serum identity.
51:
52:**Result:** `Pass | Fail | Blocked | N/A`
53:
54:### PSP-UI-03: Glucose under a CBC heading does not become whole-blood glucose
55:
56:1. Locate a glucose row printed under the CBC heading.
57:
58:**Expected result:** Glucose stays incomplete and is not `glucose_whole_blood`.
59:
60:**Result:** `Pass | Fail | Blocked | N/A`
61:
62:### PSP-UI-04: Reprocess of a pre-heading document does not invent a specimen
63:
64:**Precondition:** `PSP-02` was extracted before section headings were stored.
65:
66:1. Click **Reprocess**.
67:2. Inspect CBC rows after processing finishes.
68:
69:**Expected result:** Identity does not become whole-blood CBC measurements unless a new extraction captured the heading.
70:
71:**Result:** `Pass | Fail | Blocked | N/A`
72:
73:### PSP-UI-05: No new reviewer control
74:
75:1. Review CBC and biochemistry rows.
76:
77:**Expected result:** No new control to edit panel policies or pick a specimen per row.
78:
79:**Result:** `Pass | Fail | Blocked | N/A`
80:
81:## Developer evidence required
82:
83:- [x] `pnpm test:panel-specimen`
84:- [x] `pnpm test:stated-axis`
85:- [x] `pnpm test:panel-specimen-db` on disposable local Supabase (3/3 PASS)
86:- [x] Candidate corpus rows `hemoglobin-cbc-heading` resolved; `glucose-cbc-heading` and `hemoglobin-unrecognised-heading` partial
87:- [x] Hash-bound `panel_specimen_policy` approval exists; `launchable: true` for `f5e7bdcd97c6df589d77626811968af095e26972547e9090b5aa88c28ed63807`
88:- [x] Heading absent from that page `ocr_text` is not stored as `section_context` (worker grounding + harness)
89:
90:## Out of scope or not manually testable yet
91:
92:- No `Biochemistry => serum` policy
93:- No LLM specimen citation
94:- No UI for editing policies
95:- Uncovered heading wording degrades to incomplete identity; measure with `pnpm audit:stated-axis -- <documentId>`
96:- Release tag after merge (`registry-v2.0.0-candidate.5` proposed; do not reuse `.2`)
97:- Optional historical backfill of document `f0a8d0c2`
98:
99:## Sample-document counts
100:
101:| | Before policy | After new extraction |
102:| --- | --- | --- |
103:| CBC rows with concrete identity | 0 after #106 | expected 28 recovered |
104:| Biochemistry rows with concrete identity | 0 | stay partial (16) |
105:
106:**Recorded run:** `2026-08-29`

- Live worker (`gpt-4o-mini`, Poppler OCR, document `dfb04cd2-d9b5-429e-963a-1eea8ce107c5`): **16 biochemistry/serology rows, 0 CBC**. All `section_context` null. EH-116 dry run on that extract: 0 improved / 16 needsReview.
- Layout-text + `gpt-4o` probe of the same PDF: **44 extracted rows**. **27 CBC rows resolved** to whole-blood identities with `specimen_from_reviewed_panel`. **ESR stayed `partial`** (not on the 18-analyte allowlist). Biochemistry/serology stayed unmatched for specimen; glucose stayed `partial` (heading transcribed as `Results`, not CBC). Generic heading `Results` was verified in page OCR and did not grant a specimen.
107:
108:## Automated regression coverage
109:
110:| Check | Command |
111:| --- | --- |
112:| Policy harness | `pnpm test:panel-specimen` |
113:| Stated-axis regression | `pnpm test:stated-axis` |
114:| Trace allowlist | `pnpm test:panel-specimen-db` |
115:| Corpus technical | `pnpm check:registry-v2-candidate-corpus-technical` |
116: