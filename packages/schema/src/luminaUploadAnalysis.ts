import { z } from 'zod';

export const UploadedFileExtractionSchema = z.object({
  originalName: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  size: z.number(),
  supported: z.boolean(),
  warnings: z.array(z.string()),
});

export const NormalizedFileContentSchema: z.ZodType<{
  fileName: string;
  fileType: string;
  detectedContentType: string;
  textContent: string;
  tables: Array<Record<string, unknown>>;
  sheets: Array<{ name: string; rows: unknown[][]; text: string }>;
  pages: Array<{ pageNumber: number; text: string; tables: Array<Record<string, unknown>> }>;
  metadata: Record<string, unknown>;
  extractionWarnings: string[];
  confidence: number;
  children?: Array<{
    fileName: string;
    fileType: string;
    detectedContentType: string;
    textContent: string;
    tables: Array<Record<string, unknown>>;
    sheets: Array<{ name: string; rows: unknown[][]; text: string }>;
    pages: Array<{ pageNumber: number; text: string; tables: Array<Record<string, unknown>> }>;
    metadata: Record<string, unknown>;
    extractionWarnings: string[];
    confidence: number;
  }>;
}> = z.lazy(() => z.object({
  fileName: z.string(),
  fileType: z.string(),
  detectedContentType: z.string(),
  textContent: z.string(),
  tables: z.array(z.record(z.unknown())),
  sheets: z.array(z.object({
    name: z.string(),
    rows: z.array(z.array(z.unknown())),
    text: z.string(),
  })),
  pages: z.array(z.object({
    pageNumber: z.number(),
    text: z.string(),
    tables: z.array(z.record(z.unknown())),
  })),
  metadata: z.record(z.unknown()),
  extractionWarnings: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  children: z.array(NormalizedFileContentSchema).optional(),
}));

const ConfidenceValueSchema = z.object({
  wert: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  quelle: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const LuminaGesellschaftInfoSchema = z.object({
  name: ConfidenceValueSchema.optional(),
  rechtsform: ConfidenceValueSchema.optional(),
  sitz: ConfidenceValueSchema.optional(),
  geschaeftsjahr: ConfidenceValueSchema.optional(),
  bilanzstichtag: ConfidenceValueSchema.optional(),
  organe: z.array(z.unknown()).default([]),
}).passthrough();

export const LuminaBilanzAnalysisSchema = z.object({
  aktiva: z.array(z.unknown()).default([]),
  passiva: z.array(z.unknown()).default([]),
  bilanzsumme_aktiva: z.union([z.number(), z.string(), z.null()]).default(null),
  bilanzsumme_passiva: z.union([z.number(), z.string(), z.null()]).default(null),
  differenz: z.union([z.number(), z.string(), z.null()]).default(null),
  plausibel: z.boolean().default(false),
}).passthrough();

export const LuminaGuVAnalysisSchema = z.object({
  verfahren: z.string().default('unbekannt'),
  positionen: z.array(z.unknown()).default([]),
  jahresergebnis: z.union([z.number(), z.string(), z.null()]).default(null),
  plausibel: z.boolean().default(false),
}).passthrough();

export const LuminaMissingInformationSchema = z.object({
  prioritaet: z.string(),
  bereich: z.string(),
  fehlende_angabe: z.string(),
  warum_erforderlich: z.string(),
  beispiel_nachfrage_an_nutzer: z.string(),
}).passthrough();

export const LuminaFindingSchema = z.object({
  prioritaet: z.string(),
  bereich: z.string(),
  beschreibung: z.string(),
  auswirkung: z.string(),
  empfehlung: z.string(),
}).passthrough();

export const LuminaNextStepSchema = z.object({
  schritt: z.number().optional(),
  massnahme: z.string().optional(),
  ziel: z.string().optional(),
  titel: z.string().optional(),
  begruendung: z.string().optional(),
  quellenstatus: z.string().optional(),
}).passthrough();

export const LuminaFileAnalysisResultSchema = z.object({
  analyse_status: z.object({
    gesamtbeurteilung: z.string().default(''),
    datenqualitaet: z.string().default('niedrig'),
    abschlussfaehigkeit: z.string().default('teilweise'),
    kurzbegruendung: z.string().default(''),
  }).passthrough(),
  dateien: z.array(z.object({
    dateiname: z.string(),
    erkannter_dateityp: z.string(),
    erkannter_inhalt: z.string(),
    relevanz: z.string(),
    datenqualitaet: z.string(),
    bemerkungen: z.string(),
  }).passthrough()).default([]),
  gesellschaft: LuminaGesellschaftInfoSchema.default({ organe: [] }),
  erkannte_abschlussbestandteile: z.record(z.unknown()).default({}),
  bilanz: LuminaBilanzAnalysisSchema.default({
    aktiva: [],
    passiva: [],
    bilanzsumme_aktiva: null,
    bilanzsumme_passiva: null,
    differenz: null,
    plausibel: false,
  }),
  guv: LuminaGuVAnalysisSchema.default({
    verfahren: 'unbekannt',
    positionen: [],
    jahresergebnis: null,
    plausibel: false,
  }),
  mapping_vorschlag: z.array(z.unknown()).default([]),
  auffaelligkeiten: z.array(LuminaFindingSchema).default([]),
  fehlende_angaben: z.array(LuminaMissingInformationSchema).default([]),
  naechste_schritte: z.array(LuminaNextStepSchema).default([]),
  fragen_an_nutzer: z.array(z.object({
    prioritaet: z.string(),
    frage: z.string(),
    zweck: z.string(),
  }).passthrough()).default([]),
}).passthrough();

export type UploadedFileExtraction = z.infer<typeof UploadedFileExtractionSchema>;
export type NormalizedFileContent = z.infer<typeof NormalizedFileContentSchema>;
export type LuminaFileAnalysisResult = z.infer<typeof LuminaFileAnalysisResultSchema>;
export type LuminaGesellschaftInfo = z.infer<typeof LuminaGesellschaftInfoSchema>;
export type LuminaBilanzAnalysis = z.infer<typeof LuminaBilanzAnalysisSchema>;
export type LuminaGuVAnalysis = z.infer<typeof LuminaGuVAnalysisSchema>;
export type LuminaMissingInformation = z.infer<typeof LuminaMissingInformationSchema>;
export type LuminaFinding = z.infer<typeof LuminaFindingSchema>;
export type LuminaNextStep = z.infer<typeof LuminaNextStepSchema>;
