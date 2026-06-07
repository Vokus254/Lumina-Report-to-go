import { LuminaFileAnalysisResultSchema, type LuminaFileAnalysisResult, type NormalizedFileContent } from '../../packages/schema/src';
import { LUMINA_UPLOAD_SYSTEM_PROMPT } from './luminaUploadPrompt';

const DEFAULT_MODEL = 'gpt-4.1-mini';
const OPENAI_TIMEOUT_MS = 60000;

type MappingRecord = Record<string, unknown>;
type CompanySizeClass = 'kleinst' | 'klein' | 'mittelgross' | 'gross' | 'unbekannt';
const AMBIGUOUS_AMOUNT_HINT = 'Zahl nicht eindeutig lesbar – bitte prüfen.';
const AMBIGUOUS_AMOUNT_FINDING = 'Einzelne Beträge konnten wegen zusammengeklebter Word-Extraktion nicht eindeutig gelesen werden.';

function extractOutputText(response: unknown): string {
  const data = response as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };
  if (typeof data.output_text === 'string') return data.output_text;
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('OpenAI response did not contain JSON text.');
}

function compactFilesForPrompt(files: NormalizedFileContent[]): unknown[] {
  return files.map(file => ({
    fileName: file.fileName,
    fileType: file.fileType,
    detectedContentType: file.detectedContentType,
    textContent: file.textContent.slice(0, 18000),
    sheets: file.sheets.map(sheet => ({
      name: sheet.name,
      rows: sheet.rows.slice(0, 80),
      text: sheet.text.slice(0, 8000),
    })),
    pages: file.pages.map(page => ({
      pageNumber: page.pageNumber,
      text: page.text.slice(0, 6000),
      tables: page.tables,
    })),
    metadata: file.metadata,
    extractionWarnings: file.extractionWarnings,
    confidence: file.confidence,
    children: file.children?.map(child => ({
      fileName: child.fileName,
      fileType: child.fileType,
      detectedContentType: child.detectedContentType,
      textContent: child.textContent.slice(0, 10000),
      sheets: child.sheets.map(sheet => ({
        name: sheet.name,
        rows: sheet.rows.slice(0, 50),
        text: sheet.text.slice(0, 5000),
      })),
      pages: child.pages.map(page => ({
        pageNumber: page.pageNumber,
        text: page.text.slice(0, 4000),
        tables: page.tables,
      })),
      metadata: child.metadata,
      extractionWarnings: child.extractionWarnings,
      confidence: child.confidence,
    })),
  }));
}

function hasAmbiguousGermanNumber(value: unknown): boolean {
  if (typeof value === 'number') return false;
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  const numericPart = raw.replace(/[^\d,.-]/g, '');
  if (!/\d/.test(numericPart)) return false;
  if ((numericPart.match(/,/g) || []).length > 1) return true;
  const decimalMatch = numericPart.match(/,(\d+)/);
  if (decimalMatch && decimalMatch[1].length > 2) return true;
  return /\d[\d.]*,\d{2}\d[\d.]*,\d{1,2}/.test(numericPart);
}

function parseGermanNumber(value: unknown): { value: number | null; invalid: boolean } {
  if (typeof value === 'number' && Number.isFinite(value)) return { value, invalid: false };
  const raw = String(value ?? '').trim();
  if (!raw) return { value: null, invalid: false };
  const numericPart = raw.replace(/[^\d,.-]/g, '');
  if (!/\d/.test(numericPart)) return { value: null, invalid: false };
  if (hasAmbiguousGermanNumber(raw)) return { value: null, invalid: true };
  if ((numericPart.match(/,/g) || []).length > 1) return { value: null, invalid: true };
  const normalized = numericPart.includes(',')
    ? numericPart.replace(/\./g, '').replace(',', '.')
    : numericPart.replace(/,/g, '');
  const parsed = Number(normalized);
  return { value: Number.isFinite(parsed) ? parsed : null, invalid: !Number.isFinite(parsed) };
}

function detectUnit(context: string): 'TEUR' | 'EUR' | 'UNKLAR' {
  const normalized = context.toLowerCase();
  if (/\bteur\b|t€|t\s*€|in\s+tausend\s+euro|in\s+tausend\s+eur|tausend\s+euro/.test(normalized)) return 'TEUR';
  if (/\beur\b|€|euro/.test(normalized)) return 'EUR';
  return 'UNKLAR';
}

function normalizeSourceLabel(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findContextForMapping(mapping: MappingRecord, files: NormalizedFileContent[]): string {
  const label = normalizeSourceLabel(mapping['quelle_bezeichnung'] ?? mapping['quelle'] ?? mapping['position']);
  const significantWords = label.split(' ').filter(word => word.length >= 4).slice(0, 5);
  const allTexts = files.flatMap(file => [
    file.textContent,
    ...(file.children?.map(child => child.textContent) ?? []),
  ]);
  for (const text of allTexts) {
    const lines = String(text || '').split(/\r?\n/);
    const foundIndex = lines.findIndex(line => {
      const normalizedLine = normalizeSourceLabel(line);
      if (label && normalizedLine.includes(label.slice(0, Math.min(label.length, 60)))) return true;
      return significantWords.length > 0 && significantWords.every(word => normalizedLine.includes(word));
    });
    if (foundIndex >= 0) {
      return lines.slice(Math.max(0, foundIndex - 2), foundIndex + 3).join('\n');
    }
  }
  return allTexts.join('\n').slice(0, 5000);
}

function buildOriginalValue(rawValue: unknown, unit: 'TEUR' | 'EUR' | 'UNKLAR', context: string): string {
  const explicitMatch = context.match(/\b(TEUR|T€|T\s*€|EUR|€)\s*[-+]?\d[\d.\s]*(?:,\d+)?|\b[-+]?\d[\d.\s]*(?:,\d+)?\s*(TEUR|T€|T\s*€|EUR|€)\b/i);
  if (explicitMatch) return explicitMatch[0].replace(/\s+/g, ' ').trim();
  return unit === 'UNKLAR' ? String(rawValue ?? '') : `${unit} ${String(rawValue ?? '')}`;
}

function buildAmbiguousOriginalValue(rawValue: unknown, context: string): string {
  const raw = String(rawValue ?? '').trim();
  if (raw) return raw;
  const match = context.match(/\b(?:TEUR|Tâ‚¬|T\s*â‚¬|EUR|â‚¬)?\s*[-+]?\d[\d.]*(?:,\d+){1,2}\b/i);
  return match ? match[0].replace(/\s+/g, ' ').trim() : '';
}

export function normalizeAmountForAnalysis(rawValue: unknown, context: string): {
  original_wert?: string;
  erkannter_wert_eur?: number;
  einheit: 'TEUR' | 'EUR' | 'UNKLAR';
  confidencePenalty: boolean;
  invalid: boolean;
  hinweis?: string;
} {
  const parsed = parseGermanNumber(rawValue);
  const unit = detectUnit(`${String(rawValue ?? '')}\n${context}`);
  if (parsed.value === null) {
    return {
      original_wert: parsed.invalid ? buildAmbiguousOriginalValue(rawValue, context) : undefined,
      einheit: unit,
      confidencePenalty: parsed.invalid || unit === 'UNKLAR',
      invalid: parsed.invalid,
      hinweis: parsed.invalid ? AMBIGUOUS_AMOUNT_HINT : undefined,
    };
  }
  const multiplier = unit === 'TEUR' ? 1000 : 1;
  return {
    original_wert: buildOriginalValue(rawValue, unit, context),
    erkannter_wert_eur: unit === 'UNKLAR' ? parsed.value : parsed.value * multiplier,
    einheit: unit,
    confidencePenalty: unit === 'UNKLAR',
    invalid: parsed.invalid,
  };
}

function addFindingOnce(result: LuminaFileAnalysisResult, description: string, recommendation: string): void {
  const existing = result.auffaelligkeiten.some(finding => finding.beschreibung === description);
  if (existing) return;
  result.auffaelligkeiten.push({
    prioritaet: 'mittel',
    bereich: 'Beträge',
    beschreibung: description,
    auswirkung: 'Beträge können um Faktor 1.000 falsch interpretiert werden.',
    empfehlung: recommendation,
  });
}

function addAmbiguousAmountFindingOnce(result: LuminaFileAnalysisResult): void {
  const existing = result.auffaelligkeiten.some(finding => finding.beschreibung === AMBIGUOUS_AMOUNT_FINDING);
  if (existing) return;
  result.auffaelligkeiten.push({
    prioritaet: 'hoch',
    bereich: 'Zahlenextraktion',
    beschreibung: AMBIGUOUS_AMOUNT_FINDING,
    auswirkung: 'Einzelne Beträge werden nicht als sicher erkannte Werte übernommen.',
    empfehlung: 'Bitte Bilanz/GuV oder Anhang als strukturierte Excel-Datei nachreichen oder Word-Zahlen manuell prüfen.',
  });
}

function normalizedAnalysisText(result: LuminaFileAnalysisResult): string {
  return JSON.stringify(result)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function inferCompanySizeClass(result: LuminaFileAnalysisResult): CompanySizeClass {
  const haystack = normalizedAnalysisText(result);
  if (/\bkleinst(?:kapitalgesellschaft|gesellschaft)?\b|micro/.test(haystack)) return 'kleinst';
  if (/\bkleine? kapitalgesellschaft\b|\bkleine? gmbh\b|\bkleine? gesellschaft\b|\bklein\b/.test(haystack)) return 'klein';
  if (/mittelgrosse? kapitalgesellschaft|mittelgrosse? gesellschaft|mittelgross|mittelgro/.test(haystack)) return 'mittelgross';
  if (/\bgrosse? kapitalgesellschaft\b|\bgrosse? gesellschaft\b|\bgross\b|\bgro/.test(haystack)) return 'gross';
  return 'unbekannt';
}

function hasCapitalCompanyForm(result: LuminaFileAnalysisResult): boolean {
  return /\bgmbh\b|\bggmbh\b|\bug\b|\bag\b|\bkgaa\b|kapitalgesellschaft/.test(normalizedAnalysisText(result));
}

function hasSpecialNonProfitOrLiquidationContext(result: LuminaFileAnalysisResult): boolean {
  return /\bggmbh\b|gemeinnuetzig|gemeinnutzig|stiftung|\bi\.?\s*l\.?\b|in liquidation|liquidation/.test(normalizedAnalysisText(result));
}

function boolLike(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized.includes('true') || normalized.includes('ja') || normalized.includes('vorhanden');
  }
  return false;
}

function missingItemText(item: unknown): string {
  const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
  return `${String(record['bereich'] ?? '')} ${String(record['fehlende_angabe'] ?? '')} ${String(record['warum_erforderlich'] ?? '')}`.toLowerCase();
}

function upsertMissingItem(
  result: LuminaFileAnalysisResult,
  keyword: 'lagebericht' | 'anhang',
  item: { prioritaet: string; bereich: string; fehlende_angabe: string; warum_erforderlich: string; beispiel_nachfrage_an_nutzer: string },
): void {
  const existing = result.fehlende_angaben.find(entry => missingItemText(entry).includes(keyword));
  if (existing) {
    Object.assign(existing, item);
    return;
  }
  result.fehlende_angaben.push(item);
}

export function normalizeMissingDisclosureRequirements(result: LuminaFileAnalysisResult): LuminaFileAnalysisResult {
  const sizeClass = inferCompanySizeClass(result);
  const capitalCompany = hasCapitalCompanyForm(result);
  const specialContext = hasSpecialNonProfitOrLiquidationContext(result);
  const parts = result.erkannte_abschlussbestandteile ?? {};
  const anhangMissing = !boolLike(parts['anhang']);
  const lageberichtMissing = !boolLike(parts['lagebericht']);

  if (lageberichtMissing) {
    if (sizeClass === 'mittelgross' || sizeClass === 'gross') {
      upsertMissingItem(result, 'lagebericht', {
        prioritaet: 'zwingend',
        bereich: 'Lagebericht',
        fehlende_angabe: 'Lagebericht fehlt',
        warum_erforderlich: 'Bei mittelgrossen und grossen Kapitalgesellschaften ist der Lagebericht grundsaetzlich erforderlich.',
        beispiel_nachfrage_an_nutzer: 'Bitte laden Sie den Lagebericht hoch oder bestaetigen Sie, dass die Gesellschaft nicht lageberichtspflichtig ist.',
      });
    } else if (sizeClass === 'klein' || sizeClass === 'kleinst') {
      upsertMissingItem(result, 'lagebericht', {
        prioritaet: 'optional',
        bereich: 'Lagebericht',
        fehlende_angabe: 'Lagebericht nicht hochgeladen',
        warum_erforderlich: 'Bei kleinen Kapitalgesellschaften ist ein Lagebericht nach HGB grundsaetzlich nicht zwingend, sofern keine Sonderpflicht besteht.',
        beispiel_nachfrage_an_nutzer: 'Bitte bestaetigen Sie die Groessenklasse und ob Satzung, Foerdermittelgeber oder Pruefungspflichten einen Lagebericht verlangen.',
      });
    } else {
      upsertMissingItem(result, 'lagebericht', {
        prioritaet: 'empfohlen',
        bereich: 'Lagebericht',
        fehlende_angabe: 'Lageberichtspflicht zu pruefen',
        warum_erforderlich: specialContext
          ? 'Pflicht abhaengig von Groessenklasse, Satzung, Gemeinnuetzigkeit, Liquidationsstatus und Pruefungspflicht zu pruefen.'
          : 'Pflicht abhaengig von Groessenklasse, Rechtsform und Pruefungspflicht zu pruefen.',
        beispiel_nachfrage_an_nutzer: 'Welche Groessenklasse liegt vor und besteht nach Satzung, Pruefungsauftrag oder Sonderrecht eine Lageberichtspflicht?',
      });
    }
  }

  if (anhangMissing && capitalCompany) {
    if (sizeClass === 'kleinst') {
      upsertMissingItem(result, 'anhang', {
        prioritaet: 'empfohlen',
        bereich: 'Anhang',
        fehlende_angabe: 'Anhang oder ersetzende Angaben fehlen',
        warum_erforderlich: 'Bei Kleinstkapitalgesellschaften koennen Erleichterungen greifen; erforderliche Angaben koennen ggf. unter der Bilanz erfolgen.',
        beispiel_nachfrage_an_nutzer: 'Liegt eine Kleinstkapitalgesellschaft vor und wurden die erforderlichen Angaben unter der Bilanz gemacht?',
      });
    } else {
      upsertMissingItem(result, 'anhang', {
        prioritaet: 'zwingend',
        bereich: 'Anhang',
        fehlende_angabe: 'Anhang fehlt',
        warum_erforderlich: sizeClass === 'unbekannt'
          ? 'Bei Kapitalgesellschaften ist der Anhang grundsaetzlich erforderlich; etwaige Erleichterungen sind groessenabhaengig zu pruefen.'
          : 'Bei Kapitalgesellschaften ist der Anhang grundsaetzlich Bestandteil des Jahresabschlusses.',
        beispiel_nachfrage_an_nutzer: 'Bitte laden Sie den Anhang hoch oder bestaetigen Sie Groessenklasse und genutzte HGB-Erleichterungen.',
      });
    }
  }

  return result;
}

function normalizeMappingAmounts(result: LuminaFileAnalysisResult, files: NormalizedFileContent[]): LuminaFileAnalysisResult {
  result.mapping_vorschlag = result.mapping_vorschlag.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const mapping = { ...(item as MappingRecord) };
    const context = findContextForMapping(mapping, files);
    const normalized = normalizeAmountForAnalysis(mapping['erkannter_wert'], context);
    if (normalized.invalid) {
      mapping['original_wert'] = normalized.original_wert || String(mapping['erkannter_wert'] ?? '');
      delete mapping['erkannter_wert_eur'];
      mapping['einheit'] = normalized.einheit;
      mapping['hinweis'] = normalized.hinweis ?? AMBIGUOUS_AMOUNT_HINT;
      const currentConfidence = typeof mapping['confidence'] === 'number' ? mapping['confidence'] : 0.7;
      mapping['confidence'] = Math.min(currentConfidence, 0.6);
      addAmbiguousAmountFindingOnce(result);
      return mapping;
    }
    if (normalized.erkannter_wert_eur !== undefined) {
      mapping['original_wert'] = normalized.original_wert;
      mapping['erkannter_wert_eur'] = normalized.erkannter_wert_eur;
      mapping['einheit'] = normalized.einheit;
    }
    if (normalized.confidencePenalty) {
      const currentConfidence = typeof mapping['confidence'] === 'number' ? mapping['confidence'] : 0.7;
      mapping['confidence'] = Math.min(currentConfidence, 0.6);
      addFindingOnce(result, 'Einheit des Betrags unklar – bitte prüfen.', 'Bitte bestätigen, ob die Beträge in EUR oder TEUR angegeben sind.');
    }
    return mapping;
  });
  return result;
}

export async function analyzeNormalizedFiles(files: NormalizedFileContent[]): Promise<{
  result: LuminaFileAnalysisResult;
  model: string;
}> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY fehlt auf dem Server.');
  }

  const model = process.env['OPENAI_MODEL'] || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  const payload = {
    normalizedFiles: compactFilesForPrompt(files),
    instruction: 'Analysiere die normalisierten Upload-Inhalte ganzheitlich und gib nur valides JSON im geforderten Format zurück.',
  };

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: LUMINA_UPLOAD_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload, null, 2) },
        ],
        text: { format: { type: 'json_object' } },
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenAI request failed with status ${response.status}. ${body.slice(0, 800)}`);
    }

    const parsedJson = JSON.parse(extractOutputText(await response.json()));
    const validated = LuminaFileAnalysisResultSchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new Error(`KI-Antwort entspricht nicht dem erwarteten JSON-Schema: ${validated.error.message}`);
    }
    return { result: normalizeMissingDisclosureRequirements(normalizeMappingAmounts(validated.data, files)), model };
  } finally {
    clearTimeout(timeout);
  }
}
