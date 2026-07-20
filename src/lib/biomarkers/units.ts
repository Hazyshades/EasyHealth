import { getMeasurementConversionPolicy, getMeasurementDefinition } from "./measurement-resolution";
import type { LabUnitSystem, PresentedObservation } from "./types";

export type NativeObservation = {
  measurement_definition_key?: string | null;
  /** @deprecated Kept only for source-shape compatibility; it never selects a conversion rule. */
  biomarker_key?: string | null;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
};

function resolveDefinition(obs: NativeObservation) {
  return obs.measurement_definition_key
    ? getMeasurementDefinition(obs.measurement_definition_key)
    : undefined;
}

function roundForUnit(value: number, unit: string, key: string): number {
  const u = unit.toLowerCase();
  if (key === "hba1c" && (u.includes("mmol") || u === "mmol/mol")) return Math.round(value);
  if (key === "hba1c") return Math.round(value * 10) / 10;
  if (u.includes("µmol") || u.includes("umol")) {
    if (key === "creatinine") return Math.round(value);
    return Math.round(value * 10) / 10;
  }
  if (u.includes("mmol")) {
    if (key === "sodium" || key === "chloride") return Math.round(value);
    if (key === "potassium" || key === "bicarbonate") return Math.round(value * 10) / 10;
    if (key === "glucose" || key.includes("cholesterol") || key === "ldl" || key === "hdl") {
      return Math.round(value * 100) / 100;
    }
    return Math.round(value * 100) / 100;
  }
  if (u.includes("nmol") && key === "vitamin_d") return Math.round(value);
  return Math.round(value * 1000) / 1000;
}

function unitFamily(unit: string): "conventional" | "si" | "unknown" | "neutral" {
  const u = unit.trim().toLowerCase().replace(/μ/g, "µ").replace(/\s+/g, "");
  if (!u) return "unknown";

  if (
    u === "%" ||
    u.includes("mm/hr") ||
    u.includes("mm/h") ||
    u.includes("ml/min") ||
    u === "fl" ||
    u === "pg" ||
    u.includes("u/l") ||
    u.includes("iu/l")
  ) {
    return "neutral";
  }

  // Common SI
  if (
    u.includes("mmol/l") ||
    u.includes("µmol/l") ||
    u.includes("umol/l") ||
    u.includes("nmol/l") ||
    u.includes("pmol/l") ||
    u === "g/l" ||
    u === "l/l" ||
    u.includes("mmol/mol") ||
    u.includes("mg/mmol")
  ) {
    return "si";
  }

  // Conventional US-ish
  if (
    u.includes("mg/dl") ||
    u.includes("µg/dl") ||
    u.includes("ug/dl") ||
    u.includes("ng/ml") ||
    u.includes("pg/ml") ||
    u.includes("µiu/ml") ||
    u.includes("uiu/ml") ||
    u.includes("meq/l") ||
    u === "g/dl" ||
    u.includes("mg/g") ||
    (u === "%" && false)
  ) {
    return "conventional";
  }

  // Ambiguous equal units
  if (u.includes("miu/l") || u.includes("×10") || u.includes("x10") || u.includes("ng/ml")) {
    return "neutral";
  }

  return "unknown";
}

function convertLinear(
  value: number,
  from: "conventional" | "si",
  factorCo: number,
  factorSi: number
): number {
  return from === "conventional" ? value * factorCo : value * factorSi;
}

function convertHba1c(value: number, from: "conventional" | "si"): number {
  // NGSP % ↔ IFCC mmol/mol
  if (from === "conventional") {
    // IFCC = 10.93 * NGSP - 23.50
    return 10.93 * value - 23.5;
  }
  // NGSP = 0.09148 * IFCC + 2.152
  return 0.09148 * value + 2.152;
}

/**
 * BUN mg/dL ↔ urea nitrogen mmol/L (Labcorp factor 0.357).
 * Urea molecule mg/dL ↔ mmol/L uses 0.1665 — detected by key.
 */
function convertBunUrea(
  key: string,
  value: number,
  unit: string,
  target: LabUnitSystem
): { value: number; unit: string; note: string | null } | null {
  const fam = unitFamily(unit);
  const u = unit.toLowerCase();

  if (key === "bun") {
    if (target === "us") {
      if (fam === "conventional" || u.includes("mg/dl")) {
        return { value, unit: "mg/dL", note: null };
      }
      return {
        value: value * 2.8,
        unit: "mg/dL",
        note: "Converted for display from SI urea nitrogen",
      };
    }
    if (fam === "si" || u.includes("mmol")) {
      return { value, unit: "mmol/L", note: null };
    }
    return {
      value: value * 0.357,
      unit: "mmol/L",
      note: "Converted for display (BUN → urea nitrogen)",
    };
  }

  if (key === "urea") {
    if (target === "si") {
      if (u.includes("mmol")) return { value, unit: unit || "mmol/L", note: null };
      if (u.includes("mg/dl")) {
        return {
          value: value * 0.1665,
          unit: "mmol/L",
          note: "Converted for display (urea mg/dL → mmol/L)",
        };
      }
    }
    if (target === "us") {
      if (u.includes("mmol")) {
        return {
          value: value * 2.8,
          unit: "mg/dL",
          note: "Converted for display from urea (BUN-equivalent)",
        };
      }
      if (u.includes("mg/dl")) {
        return {
          value: value * 0.467,
          unit: "mg/dL",
          note: "Converted for display (urea → BUN-equivalent)",
        };
      }
    }
  }

  return null;
}

/**
 * Present observation in preferred lab unit system without mutating storage.
 */
export function presentObservation(
  obs: NativeObservation,
  target: LabUnitSystem
): PresentedObservation {
  const definition = resolveDefinition(obs);
  const identityKey = definition?.analyteKey ?? "";
  const original = {
    value: obs.value,
    unit: obs.unit,
    ref_low: obs.ref_low,
    ref_high: obs.ref_high,
  };

  const rule = definition ? getMeasurementConversionPolicy(definition.key) : null;

  const base: PresentedObservation = {
    value: obs.value,
    unit: obs.unit,
    ref_low: obs.ref_low,
    ref_high: obs.ref_high,
    converted: false,
    original_value: original.value,
    original_unit: original.unit,
    original_ref_low: original.ref_low,
    original_ref_high: original.ref_high,
    conversion_note: null,
  };

  if (!rule || rule.type === "none") {
    return base;
  }

  // Formula special cases
  if (rule.type === "formula") {
    if (rule.formula === "bun_urea") {
      const result = convertBunUrea(identityKey, obs.value, obs.unit, target);
      if (!result) return base;

      const converted = Boolean(result.note);
      const scale = obs.value !== 0 ? result.value / obs.value : 1;

      let ref_low = obs.ref_low;
      let ref_high = obs.ref_high;
      if (converted && scale !== 1) {
        if (ref_low != null) ref_low = roundForUnit(ref_low * scale, result.unit, identityKey);
        if (ref_high != null) ref_high = roundForUnit(ref_high * scale, result.unit, identityKey);
      }

      return {
        value: roundForUnit(result.value, result.unit, identityKey),
        unit: result.unit,
        ref_low,
        ref_high,
        converted,
        original_value: original.value,
        original_unit: original.unit,
        original_ref_low: original.ref_low,
        original_ref_high: original.ref_high,
        conversion_note: result.note,
      };
    }

    if (rule.formula === "hba1c_ngsp_ifcc") {
      const fam = unitFamily(obs.unit);
      const wantSi = target === "si";
      const isSi =
        fam === "si" ||
        obs.unit.toLowerCase().includes("mmol/mol") ||
        (fam === "unknown" && obs.value > 20);
      const isConv =
        fam === "conventional" ||
        obs.unit.includes("%") ||
        (fam === "unknown" && obs.value <= 20);

      if (wantSi && isSi) return { ...base, unit: obs.unit || "mmol/mol" };
      if (!wantSi && isConv) return { ...base, unit: obs.unit || "%" };

      if (wantSi && isConv) {
        const v = convertHba1c(obs.value, "conventional");
        const lo = obs.ref_low != null ? convertHba1c(obs.ref_low, "conventional") : null;
        const hi = obs.ref_high != null ? convertHba1c(obs.ref_high, "conventional") : null;
        return {
          value: roundForUnit(v, "mmol/mol", identityKey),
          unit: "mmol/mol",
          ref_low: lo != null ? roundForUnit(lo, "mmol/mol", identityKey) : null,
          ref_high: hi != null ? roundForUnit(hi, "mmol/mol", identityKey) : null,
          converted: true,
          original_value: original.value,
          original_unit: original.unit,
          original_ref_low: original.ref_low,
          original_ref_high: original.ref_high,
          conversion_note: "Converted for display (NGSP % → IFCC mmol/mol)",
        };
      }
      if (!wantSi && isSi) {
        const v = convertHba1c(obs.value, "si");
        const lo = obs.ref_low != null ? convertHba1c(obs.ref_low, "si") : null;
        const hi = obs.ref_high != null ? convertHba1c(obs.ref_high, "si") : null;
        return {
          value: roundForUnit(v, "%", identityKey),
          unit: "%",
          ref_low: lo != null ? roundForUnit(lo, "%", identityKey) : null,
          ref_high: hi != null ? roundForUnit(hi, "%", identityKey) : null,
          converted: true,
          original_value: original.value,
          original_unit: original.unit,
          original_ref_low: original.ref_low,
          original_ref_high: original.ref_high,
          conversion_note: "Converted for display (IFCC mmol/mol → NGSP %)",
        };
      }
      return base;
    }
  }

  if (rule.type === "equal") {
    const wantUnit = target === "si" ? rule.siUnit : rule.conventionalUnit;
    const fam = unitFamily(obs.unit);
    // Numeric equal — only swap label when we can infer family or unit empty
    if (fam === "neutral" || fam === "unknown") {
      return {
        ...base,
        unit: obs.unit || wantUnit,
        converted: Boolean(obs.unit && obs.unit !== wantUnit),
        conversion_note:
          obs.unit && obs.unit !== wantUnit
            ? `Unit label preference: ${wantUnit}`
            : null,
      };
    }
    return {
      ...base,
      unit: wantUnit,
      converted: obs.unit !== wantUnit,
      conversion_note: obs.unit !== wantUnit ? "Unit label normalized for display" : null,
    };
  }

  if (rule.type === "linear") {
    const fam = unitFamily(obs.unit);
    const wantSi = target === "si";

    // Already in target family
    if (wantSi && fam === "si") return { ...base, unit: obs.unit || rule.siUnit };
    if (!wantSi && fam === "conventional") return { ...base, unit: obs.unit || rule.conventionalUnit };
    if (fam === "neutral") return base;

    // Unknown unit: do not guess
    if (fam === "unknown") return base;

    // Need conversion
    if (wantSi && fam === "conventional") {
      const v = convertLinear(obs.value, "conventional", rule.factorCo, rule.factorSi);
      const lo =
        obs.ref_low != null
          ? convertLinear(obs.ref_low, "conventional", rule.factorCo, rule.factorSi)
          : null;
      const hi =
        obs.ref_high != null
          ? convertLinear(obs.ref_high, "conventional", rule.factorCo, rule.factorSi)
          : null;
      return {
        value: roundForUnit(v, rule.siUnit, identityKey),
        unit: rule.siUnit,
        ref_low: lo != null ? roundForUnit(lo, rule.siUnit, identityKey) : null,
        ref_high: hi != null ? roundForUnit(hi, rule.siUnit, identityKey) : null,
        converted: true,
        original_value: original.value,
        original_unit: original.unit,
        original_ref_low: original.ref_low,
        original_ref_high: original.ref_high,
        conversion_note: `Converted for display · Original: ${original.value} ${original.unit}`,
      };
    }

    if (!wantSi && fam === "si") {
      const v = convertLinear(obs.value, "si", rule.factorCo, rule.factorSi);
      const lo =
        obs.ref_low != null
          ? convertLinear(obs.ref_low, "si", rule.factorCo, rule.factorSi)
          : null;
      const hi =
        obs.ref_high != null
          ? convertLinear(obs.ref_high, "si", rule.factorCo, rule.factorSi)
          : null;
      return {
        value: roundForUnit(v, rule.conventionalUnit, identityKey),
        unit: rule.conventionalUnit,
        ref_low: lo != null ? roundForUnit(lo, rule.conventionalUnit, identityKey) : null,
        ref_high: hi != null ? roundForUnit(hi, rule.conventionalUnit, identityKey) : null,
        converted: true,
        original_value: original.value,
        original_unit: original.unit,
        original_ref_low: original.ref_low,
        original_ref_high: original.ref_high,
        conversion_note: `Converted for display · Original: ${original.value} ${original.unit}`,
      };
    }
  }

  return base;
}

export function presentObservations<T extends NativeObservation>(
  rows: T[],
  target: LabUnitSystem
): Array<T & PresentedObservation> {
  return rows.map((row) => {
    const presented = presentObservation(row, target);
    return { ...row, ...presented };
  });
}
