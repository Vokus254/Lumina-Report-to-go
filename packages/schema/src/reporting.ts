import { z } from "zod";

/**
 * Fachliche Berichtslogik-Schemas.
 *
 * Diese Schemas modellieren die STRUKTUR des Berichts (welche Abschnitte
 * existieren, welche Pflichtangaben erfüllt sind) — getrennt von den
 * KI-generierten Texten. Die Regel-Engine bestimmt anhand dieser Schemas,
 * welche Abschnitte vorhanden sein müssen. Die KI füllt nur die Texte aus.
 */

// ── ReviewStatus ─────────────────────────────────────────────────────────────

export const ReviewStatusSchema = z.enum([
  "draft",     // In Bearbeitung
  "reviewed",  // Geprüft (intern)
  "approved",  // Freigegeben
  "locked",    // Gesperrt (nach Unterzeichnung)
]);

export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

// ── Evidence ─────────────────────────────────────────────────────────────────

/**
 * Nachweis/Beleg für eine Pflichtangabe.
 * z.B. Aufsichtsratsbeschluss, Jahresabschluss-Dokument, Excel-Import.
 */
export const EvidenceSchema = z.object({
  evidenceId: z.string(),
  source: z.enum(["excel_import", "manual_input", "external_document", "computed"]),
  fieldPath: z.string(), // z.B. "bilanz.pensionsrueckstellungen"
  value: z.unknown(),   // Der nachgewiesene Wert
  verified: z.boolean().default(false),
  verifiedAt: z.string().datetime().optional(),
  note: z.string().optional(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

// ── ValidationFinding ────────────────────────────────────────────────────────

/**
 * Ergebnis einer Validierungsregel (Pflichtfeld fehlt, Wert inkonsistent, etc.)
 */
export const ValidationFindingSchema = z.object({
  findingId: z.string(),
  ruleId: z.string(),           // z.B. "HGB_266_BILANZ_BALANCE"
  severity: z.enum(["error", "warning", "info"]),
  fieldPath: z.string().optional(), // Betroffenes Feld
  message: z.string(),
  hgbReference: z.string().optional(), // z.B. "§ 266 HGB"
  resolvedAt: z.string().datetime().optional(),
});

export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;

// ── DisclosureRequirement ────────────────────────────────────────────────────

/**
 * Eine HGB-Pflichtangabe (§ 284 ff., § 285 HGB).
 * Bestimmt durch die Regel-Engine — NICHT durch die KI.
 */
export const DisclosureRequirementSchema = z.object({
  requirementId: z.string(),
  hgbParagraph: z.string(),     // z.B. "§ 285 Nr. 17 HGB"
  title: z.string(),
  required: z.boolean(),        // Pflicht für diese Gesellschaft?
  fulfilled: z.boolean().default(false),
  basis: z.enum([
    "always",           // Immer Pflicht
    "conditional",      // Nur wenn Bedingung erfüllt (z.B. AG)
    "voluntary",        // Freiwillig
  ]),
  condition: z.string().optional(), // Menschenlesbare Bedingung
  evidence: z.array(EvidenceSchema).default([]),
  findings: z.array(ValidationFindingSchema).default([]),
});

export type DisclosureRequirement = z.infer<typeof DisclosureRequirementSchema>;

// ── ReportSection ────────────────────────────────────────────────────────────

/**
 * Ein Abschnitt im Jahresabschluss (z.B. "B.4 Eigenkapital").
 * Enthält den KI-generierten Text UND die zugehörigen Pflichtangaben.
 */
export const ReportSectionSchema = z.object({
  sectionId: z.string(),        // z.B. "anhang_b4_eigenkapital"
  documentType: z.enum(["lagebericht", "bilanz_guv", "anhang"]),
  title: z.string(),
  order: z.number().int(),
  aiGenerated: z.boolean(),     // Wurde Text von KI generiert?
  aiTextKey: z.string().optional(), // Key in AiTextsSchema
  required: z.boolean(),
  status: ReviewStatusSchema.default("draft"),
  disclosures: z.array(DisclosureRequirementSchema).default([]),
  findings: z.array(ValidationFindingSchema).default([]),
  lockedAt: z.string().datetime().optional(),
});

export type ReportSection = z.infer<typeof ReportSectionSchema>;
