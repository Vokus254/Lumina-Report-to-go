/**
 * @nexus/schema — Zod-Schemas für den Jahresabschluss-Generator
 *
 * Zentrale Quelle aller Feldnamen und Typen.
 * Wird von Backend-Renderers, API-Routes und Frontend-Komponenten importiert.
 */

// Stammdaten
export { StammdatenSchema } from "./stammdaten";
export type { Stammdaten } from "./stammdaten";

// GuV
export { GuvSchema } from "./guv";
export type { Guv } from "./guv";

// Bilanz
export { BilanzSchema } from "./bilanz";
export type { Bilanz } from "./bilanz";

// Kennzahlen
export { KennzahlenSchema } from "./kennzahlen";
export type { Kennzahlen } from "./kennzahlen";

// Organe & Arrays
export {
  OrganeSchema,
  SegmentSchema,
  BeteiligungSchema,
  VorstandsmitgliedSchema,
  AufsichtsratsmitgliedSchema,
} from "./organe";
export type {
  Organe,
  Segment,
  Beteiligung,
  Vorstandsmitglied,
  Aufsichtsratsmitglied,
} from "./organe";

// KI-Texte
export {
  AiTextsSchema,
  LageberichtTexteSchema,
  AnhangTexteSchema,
} from "./aiTexts";
export type { AiTexts, LageberichtTexte, AnhangTexte } from "./aiTexts";

// Berichtslogik (Regel-Engine)
export {
  ReviewStatusSchema,
  EvidenceSchema,
  ValidationFindingSchema,
  DisclosureRequirementSchema,
  ReportSectionSchema,
} from "./reporting";
export type {
  ReviewStatus,
  Evidence,
  ValidationFinding,
  DisclosureRequirement,
  ReportSection,
} from "./reporting";

// Root-Schema
export {
  JahresabschlussSchema,
  JahresabschlussPartialSchema,
  DEFAULT_JAHRESABSCHLUSS,
} from "./jahresabschluss";
export type {
  JahresabschlussData,
  JahresabschlussPartial,
} from "./jahresabschluss";
