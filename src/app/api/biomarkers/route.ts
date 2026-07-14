import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileById } from "@/lib/auth/profile";
import { presentObservation } from "@/lib/biomarkers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const profile = await getProfileById(profileId);
    const unitSystem = profile.lab_unit_system ?? "si";
    const supabase = createAdminClient();
    const { data: observations } = await supabase
      .from("observations")
      .select("*, documents(id, original_filename)")
      .eq("profile_id", profileId)
      .order("observed_at", { ascending: false });

    const presented = (observations ?? []).map((row) => {
      const definitionKey = row.measurement_definition_key ?? null;
      const valueKind = (row.value_kind as string) ?? "numeric";
      const numericValue = row.value != null ? Number(row.value) : null;

      let display = {
        value: numericValue as number,
        unit: row.unit ?? "",
        ref_low: row.ref_low != null ? Number(row.ref_low) : null,
        ref_high: row.ref_high != null ? Number(row.ref_high) : null,
        converted: false,
        conversion_note: null as string | null,
        original_value: numericValue as number,
        original_unit: row.unit ?? "",
        original_ref_low: row.ref_low != null ? Number(row.ref_low) : null,
        original_ref_high: row.ref_high != null ? Number(row.ref_high) : null,
      };

      if (valueKind === "numeric" && numericValue != null && definitionKey) {
        display = presentObservation(
          {
            measurement_definition_key: definitionKey,
            value: numericValue,
            unit: row.unit ?? "",
            ref_low: row.ref_low != null ? Number(row.ref_low) : null,
            ref_high: row.ref_high != null ? Number(row.ref_high) : null,
          },
          unitSystem
        );
      }

      return {
        ...row,
        measurement_definition_key: definitionKey,
        analyte_key: row.analyte_key ?? null,
        resolution_status: row.resolution_status ?? null,
        value: valueKind === "numeric" ? display.value : null,
        value_kind: valueKind,
        value_text: row.value_text ?? (numericValue != null ? String(numericValue) : null),
        ordinal: row.ordinal ?? null,
        specimen: row.specimen ?? "unspecified",
        modifier: row.modifier ?? "none",
        unit: display.unit,
        ref_low: display.ref_low,
        ref_high: display.ref_high,
        converted: display.converted,
        conversion_note: display.conversion_note,
        original_value: display.original_value,
        original_unit: display.original_unit,
        original_ref_low: display.original_ref_low,
        original_ref_high: display.original_ref_high,
      };
    });

    return NextResponse.json({
      authenticated: true,
      profile: {
        id: profile.id,
        lab_unit_system: unitSystem,
      },
      lab_unit_system: unitSystem,
      observations: presented,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
