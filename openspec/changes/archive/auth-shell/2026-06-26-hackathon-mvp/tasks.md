## 1. Database

- [x] 1.1 Add migration `002_document_type.sql` with `document_type` column (default `lab`, check constraint) on `documents`
- [x] 1.2 Apply migration to Supabase (local or remote)

## 2. Server — APIs

- [x] 2.1 Create `src/lib/health-systems.ts` with biomarker-key → system mapping and coverage helpers
- [x] 2.2 Implement `GET /api/documents` with session auth and optional `?type=` filter
- [x] 2.3 Implement `GET /api/health-profile` with deterministic aggregation from observations
- [x] 2.4 Update `POST /api/upload` to accept optional `document_type` form field (default `lab`)

## 3. App shell & navigation

- [x] 3.1 Create `AppSidebar` component with MY HEALTH / MY DATA / REPORTS groups
- [x] 3.2 Update `src/app/app/layout.tsx` to sidebar + compact top bar (wallet balances)
- [x] 3.3 Remove or slim flat nav links from `app-header.tsx` (wallet info moves to layout top bar)
- [x] 3.4 Build `/app` dashboard page with document count, empty state, and shortcut links

## 4. Documents hub

- [x] 4.1 Create `/app/documents/page.tsx` with type tabs (Lab, Imaging, Consultation, DICOM)
- [x] 4.2 Implement document list cards fetching `GET /api/documents`
- [x] 4.3 Add "Upload your lab" CTA linking to `/app/upload`
- [x] 4.4 Add DICOM tab "Coming soon" empty state (no upload)

## 5. Biomarkers overview

- [x] 5.1 Move current `/app/page.tsx` biomarker table + chart to `/app/biomarkers/page.tsx`
- [x] 5.2 Verify `/api/biomarkers` still powers the relocated page

## 6. Health Profile

- [x] 6.1 Create `BodyMap` SVG component with positioned system badges (coverage %)
- [x] 6.2 Create `/app/profile/page.tsx` fetching `GET /api/health-profile`
- [x] 6.3 Render per-system marker details with source citations on hover or expand
- [x] 6.4 Show "Used N records" footer with contributing document list
- [x] 6.5 Add empty state and mandatory `MEDICAL_DISCLAIMER` on profile page

## 7. Upload & landing updates

- [x] 7.1 Update upload page copy to align with Documents flow (optional `?type=` passthrough)
- [x] 7.2 Update landing page (`src/app/page.tsx`) links to new routes (Documents, Profile, Biomarkers)

## 8. Verification

- [x] 8.1 Manual demo flow: sign in → upload lab ($0.01) → Documents list → Biomarkers → Health Profile → Doctor summary ($0.05)
- [x] 8.2 Confirm no diagnostic/risk-score language on Health Profile
- [x] 8.3 Confirm x402 still returns 402 on unpaid upload and doctor-summary requests
