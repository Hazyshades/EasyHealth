"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";

type Clinic = {
  clinic_id: string;
  membership_id: string;
  name: string;
  role: string;
  membership_status: string;
};

type Membership = {
  membership_id: string;
  clinic_id: string;
  clinic_name: string;
  clinician_profile_id: string;
  clinician_name: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

type AccessRow = {
  perspective: "patient" | "clinician";
  grant_id: string;
  clinic_id: string;
  clinic_name: string;
  patient_profile_id: string;
  patient_name: string;
  clinician_profile_id: string;
  clinician_name: string;
  state: string;
  scopes: string[];
  requested_scopes: string[];
  expires_at: string | null;
  created_at: string;
};

type Consultation = {
  consultation_id: string;
  clinic_id: string;
  patient_profile_id: string;
  patient_name: string;
  clinician_profile_id: string;
  clinician_name: string;
  title: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  sources: Array<{
    source_kind?: string;
    source_id?: string;
    availability?: string;
  }>;
  latest_note: { status?: string } | null;
  recording_consent_id: string | null;
  recording_consent_state: "active" | "revoked" | "expired" | null;
  recording_consent_expires_at: string | null;
};

type WorkspaceData = {
  enabled: boolean;
  state: "ready" | "unavailable";
  actorProfileId: string;
  clinics: Clinic[];
  memberships: Membership[];
  access: AccessRow[];
  consultations: Consultation[];
};

type ApiEnvelope = { data?: WorkspaceData; error?: string };

const SCOPES = [
  ["health_profile", "Health profile"],
  ["observations", "Observations"],
  ["reports", "Reports"],
  ["documents", "Documents"],
  ["consultations", "Consultations"],
] as const;

async function readWorkspace(): Promise<WorkspaceData> {
  const response = await fetch("/api/doctor-workspace", { cache: "no-store" });
  const payload = (await response.json()) as ApiEnvelope;
  if (!response.ok || !payload.data)
    throw new Error(payload.error ?? "unavailable");
  return payload.data;
}

async function sendAction(body: Record<string, unknown>): Promise<void> {
  const response = await fetch("/api/doctor-workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "unavailable");
  }
}

function formatGrantExpiry(value: string | null): string {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export function ClinicWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [selectedClinic, setSelectedClinic] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "health_profile",
  ]);
  const [consultationTitle, setConsultationTitle] = useState("");
  const [consultationPatientId, setConsultationPatientId] = useState("");
  const [clinicianId, setClinicianId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readWorkspace();
      setWorkspace(data);
      setSelectedClinic(
        (current) => current || data.clinics[0]?.clinic_id || "",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clinicianGrants = useMemo(
    () =>
      workspace?.access.filter(
        (row) => row.perspective === "clinician" && row.state === "active",
      ) ?? [],
    [workspace],
  );
  const patientGrants = useMemo(
    () =>
      workspace?.access.filter((row) => row.perspective === "patient") ?? [],
    [workspace],
  );

  async function run(body: Record<string, unknown>) {
    setWorking(true);
    setError(null);
    try {
      await sendAction(body);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setWorking(false);
    }
  }

  function toggleScope(scope: string) {
    setSelectedScopes((current) =>
      current.includes(scope)
        ? current.filter((value) => value !== scope)
        : [...current, scope],
    );
  }

  if (loading) {
    return <WorkspaceLoading />;
  }
  if (error && !workspace) {
    return (
      <WorkspaceState
        title="Clinic unavailable"
        message="The workspace could not be loaded."
        action={refresh}
      />
    );
  }
  if (!workspace?.enabled) {
    return (
      <WorkspaceState
        title="Clinic unavailable"
        message="Clinician access is not enabled for this account."
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Clinic"
        subtitle="Approved patient relationships and source-grounded consultations"
        actions={
          <Button
            variant="outline"
            onClick={() => void refresh()}
            disabled={working}
          >
            Refresh
          </Button>
        }
      />
      {error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <SurfaceCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
                Memberships
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--eh-text-primary)]">
                Your clinics
              </h2>
            </div>
            <StatusChip
              variant={workspace.clinics.length ? "success" : "neutral"}
            >
              {workspace.clinics.length
                ? `${workspace.clinics.length} active`
                : "None"}
            </StatusChip>
          </div>
          {workspace.clinics.length ? (
            <ul className="mt-5 space-y-3">
              {workspace.clinics.map((clinic) => (
                <li
                  key={clinic.clinic_id}
                  className="rounded-md border border-[var(--eh-border)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[var(--eh-text-primary)]">
                      {clinic.name}
                    </span>
                    <span className="text-xs text-[var(--eh-text-secondary)]">
                      {clinic.role}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                    Membership {clinic.membership_status}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-md border border-dashed border-[var(--eh-border)] px-4 py-5 text-sm text-[var(--eh-text-secondary)]">
              No active clinic memberships yet.
            </p>
          )}
          <form
            className="mt-5 flex flex-col gap-2 border-t border-[var(--eh-border)] pt-5 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (clinicName.trim())
                void run({ action: "create_clinic", name: clinicName });
            }}
          >
            <label className="sr-only" htmlFor="clinic-name">
              Clinic name
            </label>
            <Input
              id="clinic-name"
              value={clinicName}
              onChange={(event) => setClinicName(event.target.value)}
              placeholder="Clinic name"
              maxLength={160}
            />
            <Button
              type="submit"
              variant="brand"
              disabled={working || !clinicName.trim()}
            >
              Create clinic
            </Button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
            Patient access
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--eh-text-primary)]">
            Invite a patient
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
            Use the patient profile ID supplied by your approved onboarding
            process. No directory lookup is performed here.
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !selectedClinic ||
                !patientId.trim() ||
                selectedScopes.length === 0
              )
                return;
              void run({
                action: "invite_patient",
                clinicId: selectedClinic,
                patientProfileId: patientId.trim(),
                requestedScopes: selectedScopes,
              });
            }}
          >
            <label
              className="block text-sm font-medium text-[var(--eh-text-primary)]"
              htmlFor="invite-clinic"
            >
              Clinic
              <select
                id="invite-clinic"
                className="mt-2 h-10 w-full rounded-md border border-[var(--eh-border)] bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
                value={selectedClinic}
                onChange={(event) => setSelectedClinic(event.target.value)}
              >
                <option value="">Select a clinic</option>
                {workspace.clinics.map((clinic) => (
                  <option key={clinic.clinic_id} value={clinic.clinic_id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="block text-sm font-medium text-[var(--eh-text-primary)]"
              htmlFor="patient-profile-id"
            >
              Patient profile ID
              <Input
                id="patient-profile-id"
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                placeholder="UUID"
              />
            </label>
            <fieldset>
              <legend className="text-sm font-medium text-[var(--eh-text-primary)]">
                Requested scopes
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {SCOPES.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex min-h-9 items-center gap-2 rounded-md border border-[var(--eh-border)] px-3 text-sm text-[var(--eh-text-secondary)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(value)}
                      onChange={() => toggleScope(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button
              type="submit"
              variant="brand"
              disabled={
                working ||
                !selectedClinic ||
                !patientId.trim() ||
                selectedScopes.length === 0
              }
            >
              Send access request
            </Button>
          </form>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
              Clinician access
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--eh-text-primary)]">
              Active patient grants
            </h2>
          </div>
          <StatusChip
            variant={clinicianGrants.length ? "success" : "neutral"}
          >
            {clinicianGrants.length
              ? `${clinicianGrants.length} active`
              : "Empty"}
          </StatusChip>
        </div>
        {clinicianGrants.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {clinicianGrants.map((grant) => (
              <article
                key={grant.grant_id}
                className="rounded-md border border-[var(--eh-border)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-[var(--eh-text-primary)]">
                    {grant.patient_name}
                  </h3>
                  <StatusChip variant="success">{grant.state}</StatusChip>
                </div>
                <p className="mt-2 text-xs text-[var(--eh-text-secondary)]">
                  {grant.clinic_name} · {grant.scopes.join(", ")}
                </p>
                <p className="mt-1 break-all text-xs text-[var(--eh-text-muted)]">
                  {grant.patient_profile_id}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-md border border-dashed border-[var(--eh-border)] px-4 py-5 text-sm text-[var(--eh-text-secondary)]">
            No active patient grants for this account.
          </p>
        )}
      </SurfaceCard>

      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
              Patient access decisions
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--eh-text-primary)]">
              Your patient access
            </h2>
          </div>
          <StatusChip
            variant={patientGrants.length ? "success" : "neutral"}
          >
            {patientGrants.length
              ? `${patientGrants.length} records`
              : "Empty"}
          </StatusChip>
        </div>
        {patientGrants.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {patientGrants.map((grant) => (
              <article
                key={grant.grant_id}
                className="rounded-md border border-[var(--eh-border)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-[var(--eh-text-primary)]">
                    {grant.clinic_name}
                  </h3>
                  <StatusChip
                    variant={
                      grant.state === "pending"
                        ? "warning"
                        : grant.state === "active"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {grant.state}
                  </StatusChip>
                </div>
                <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
                  {grant.clinician_name}
                </p>
                <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                  Requested scopes: {grant.requested_scopes.join(", ")}
                </p>
                {grant.state === "active" ? (
                  <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                    Approved scopes: {grant.scopes.join(", ")}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                  Expires: {formatGrantExpiry(grant.expires_at)}
                </p>
                {grant.state === "pending" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="brand"
                      size="sm"
                      disabled={working}
                      onClick={() =>
                        void run({
                          action: "approve_patient",
                          grantId: grant.grant_id,
                        })
                      }
                    >
                      Approve requested scopes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={working}
                      onClick={() =>
                        void run({
                          action: "revoke_patient",
                          grantId: grant.grant_id,
                        })
                      }
                    >
                      Decline
                    </Button>
                  </div>
                ) : grant.state === "active" ? (
                  <Button
                    className="mt-4"
                    variant="outline"
                    size="sm"
                    disabled={working}
                    onClick={() =>
                      void run({
                        action: "revoke_patient",
                        grantId: grant.grant_id,
                      })
                    }
                  >
                    Revoke approval
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-md border border-dashed border-[var(--eh-border)] px-4 py-5 text-sm text-[var(--eh-text-secondary)]">
            No patient access requests.
          </p>
        )}
      </SurfaceCard>

      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
              Consultations
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--eh-text-primary)]">
              Start a consultation
            </h2>
          </div>
          <StatusChip variant="neutral">
            {workspace.consultations.length
              ? `${workspace.consultations.length} records`
              : "Empty"}
          </StatusChip>
        </div>

        {workspace.consultations
          .filter(
            (consultation) =>
              consultation.patient_profile_id === workspace.actorProfileId &&
              consultation.recording_consent_id &&
              consultation.recording_consent_state === "active",
          )
          .map((consultation) => (
            <SurfaceCard
              key={`${consultation.consultation_id}-consent`}
              className="p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
                    Recording consent
                  </p>
                  <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
                    {consultation.title} has active recording consent.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={working}
                  onClick={() =>
                    void run({
                      action: "revoke_recording_consent",
                      consentId: consultation.recording_consent_id,
                    })
                  }
                >
                  Revoke consent
                </Button>
              </div>
            </SurfaceCard>
          ))}
        <form
          className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedClinic && consultationPatientId.trim())
              void run({
                action: "create_consultation",
                clinicId: selectedClinic,
                patientProfileId: consultationPatientId.trim(),
                title: consultationTitle.trim() || undefined,
              });
          }}
        >
          <label className="text-sm font-medium text-[var(--eh-text-primary)]">
            Clinic
            <select
              className="mt-2 h-10 w-full rounded-md border border-[var(--eh-border)] bg-transparent px-3 text-sm"
              value={selectedClinic}
              onChange={(event) => setSelectedClinic(event.target.value)}
            >
              <option value="">Select</option>
              {workspace.clinics.map((clinic) => (
                <option key={clinic.clinic_id} value={clinic.clinic_id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[var(--eh-text-primary)]">
            Patient profile ID
            <Input
              className="mt-2"
              value={consultationPatientId}
              onChange={(event) => setConsultationPatientId(event.target.value)}
              placeholder="UUID"
            />
          </label>
          <label className="text-sm font-medium text-[var(--eh-text-primary)]">
            Title
            <Input
              className="mt-2"
              value={consultationTitle}
              onChange={(event) => setConsultationTitle(event.target.value)}
              placeholder="Consultation"
              maxLength={240}
            />
          </label>
          <Button
            className="self-end"
            type="submit"
            variant="brand"
            disabled={
              working || !selectedClinic || !consultationPatientId.trim()
            }
          >
            Start
          </Button>
        </form>
        {workspace.consultations.length ? (
          <div className="mt-6 grid gap-3 xl:grid-cols-2">
            {workspace.consultations.map((consultation) => (
              <article
                key={consultation.consultation_id}
                className="rounded-md border border-[var(--eh-border)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-[var(--eh-text-primary)]">
                    {consultation.title}
                  </h3>
                  <StatusChip
                    variant={
                      consultation.status === "in_progress"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {consultation.status}
                  </StatusChip>
                </div>
                <p className="mt-2 text-sm text-[var(--eh-text-secondary)]">
                  {consultation.patient_name} · {consultation.clinician_name}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {consultation.sources.length ? (
                    consultation.sources.map((source) => (
                      <span
                        key={`${source.source_kind}-${source.source_id}`}
                        className="rounded-full border border-[var(--eh-border)] px-2.5 py-1 text-xs text-[var(--eh-text-secondary)]"
                      >
                        {source.source_kind}: {source.availability}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[var(--eh-text-muted)]">
                      No attached sources
                    </span>
                  )}
                </div>
                {consultation.latest_note ? (
                  <p className="mt-3 text-xs text-[var(--eh-text-secondary)]">
                    Latest note:{" "}
                    {consultation.latest_note.status ?? "available"}
                  </p>
                ) : null}
                {consultation.patient_profile_id ===
                workspace.actorProfileId ? (
                  <Button
                    className="mt-4"
                    variant="outline"
                    size="sm"
                    disabled={working}
                    onClick={() =>
                      void run({
                        action: "grant_recording_consent",
                        consultationId: consultation.consultation_id,
                      })
                    }
                  >
                    Allow recording
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-md border border-dashed border-[var(--eh-border)] px-4 py-5 text-sm text-[var(--eh-text-secondary)]">
            No consultations yet.
          </p>
        )}
      </SurfaceCard>

      <SurfaceCard className="p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--eh-text-muted)]">
          Clinician membership
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--eh-text-primary)]">
          Named clinician access
        </h2>
        {workspace.memberships.length ? (
          <ul className="mt-5 grid gap-3 lg:grid-cols-2">
            {workspace.memberships.map((membership) => (
              <li
                key={membership.membership_id}
                className="rounded-md border border-[var(--eh-border)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[var(--eh-text-primary)]">
                    {membership.clinician_name}
                  </span>
                  <StatusChip
                    variant={
                      membership.status === "active"
                        ? "success"
                        : membership.status === "invited"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {membership.status}
                  </StatusChip>
                </div>
                <p className="mt-1 text-xs text-[var(--eh-text-secondary)]">
                  {membership.clinic_name} · {membership.role}
                </p>
                <p className="mt-1 break-all text-xs text-[var(--eh-text-muted)]">
                  {membership.clinician_profile_id}
                </p>
                {membership.status === "invited" &&
                membership.clinician_profile_id === workspace.actorProfileId ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="brand"
                    disabled={working}
                    onClick={() =>
                      void run({
                        action: "accept_clinician",
                        membershipId: membership.membership_id,
                      })
                    }
                  >
                    Accept invitation
                  </Button>
                ) : null}
                {membership.status === "active" &&
                membership.role !== "owner" &&
                membership.clinician_profile_id !== workspace.actorProfileId ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    disabled={working}
                    onClick={() =>
                      void run({
                        action: "revoke_clinician",
                        membershipId: membership.membership_id,
                      })
                    }
                  >
                    Revoke membership
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-md border border-dashed border-[var(--eh-border)] px-4 py-5 text-sm text-[var(--eh-text-secondary)]">
            No named clinician memberships.
          </p>
        )}
        <form
          className="mt-5 grid gap-3 border-t border-[var(--eh-border)] pt-5 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedClinic && clinicianId.trim())
              void run({
                action: "invite_clinician",
                clinicId: selectedClinic,
                clinicianProfileId: clinicianId.trim(),
              });
          }}
        >
          <label className="text-sm font-medium text-[var(--eh-text-primary)]">
            Clinic
            <select
              className="mt-2 h-10 w-full rounded-md border border-[var(--eh-border)] bg-transparent px-3 text-sm"
              value={selectedClinic}
              onChange={(event) => setSelectedClinic(event.target.value)}
            >
              <option value="">Select</option>
              {workspace.clinics.map((clinic) => (
                <option key={clinic.clinic_id} value={clinic.clinic_id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[var(--eh-text-primary)]">
            Clinician profile ID
            <Input
              className="mt-2"
              value={clinicianId}
              onChange={(event) => setClinicianId(event.target.value)}
              placeholder="UUID"
            />
          </label>
          <Button
            className="self-end"
            type="submit"
            variant="outline"
            disabled={working || !selectedClinic || !clinicianId.trim()}
          >
            Invite clinician
          </Button>
        </form>
      </SurfaceCard>
    </div>
  );
}

function WorkspaceLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-9 w-48 animate-pulse rounded-md bg-[var(--eh-surface-muted)]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl bg-[var(--eh-surface-muted)]" />
        <div className="h-72 animate-pulse rounded-xl bg-[var(--eh-surface-muted)]" />
      </div>
    </div>
  );
}

function WorkspaceState({
  title,
  message,
  action,
}: Readonly<{ title: string; message: string; action?: () => void }>) {
  return (
    <SurfaceCard className="p-6" role="status">
      <h1 className="text-xl font-semibold text-[var(--eh-text-primary)]">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
        {message}
      </p>
      {action ? (
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => void action()}
        >
          Try again
        </Button>
      ) : null}
    </SurfaceCard>
  );
}
