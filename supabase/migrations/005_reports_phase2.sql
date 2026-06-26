-- Reports Phase 2: eight report types and abnormal_only flag

alter table public.reports
  drop constraint if exists reports_report_type_check;

alter table public.reports
  add constraint reports_report_type_check
  check (report_type in (
    'general_practice',
    'cardiology',
    'endocrinology',
    'gastroenterology',
    'hematology',
    'nephrology',
    'neurology',
    'pulmonology'
  ));

alter table public.reports
  add column if not exists abnormal_only boolean not null default false;
