import { LuminaFileAnalysisResultSchema, type LuminaFileAnalysisResult, type NormalizedFileContent } from '../../packages/schema/src';
import { LUMINA_UPLOAD_SYSTEM_PROMPT } from './luminaUploadPrompt';

const DEFAULT_MODEL = 'gpt-4.1-mini';
const OPENAI_TIMEOUT_MS = 60000;

type MappingRecord = Record<string, unknown>;

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

function parseGermanNumber(value: unknown): { value: number | null; invalid: boolean } {
  if (typeof value === 'number' && Number.isFinite(value)) return { value, invalid: false };
  const raw = String(value ?? '').trim();
  if (!raw) return { value: null, invalid: false };
  const numericPart = raw.replace(/[^\d,.-]/g, '');
  if (!/\d/.test(numericPart)) return { value: null, invalid: false };
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

export function normalizeAmountForAnalysis(rawValue: unknown, context: string): {
  original_wert?: string;
  erkannter_wert_eur?: number;
  einheit: 'TEUR' | 'EUR' | 'UNKLAR';
  confidencePenalty: boolean;
  invalid: boolean;
} {
  const parsed = parseGermanNumber(rawValue);
  const unit = detectUnit(`${String(rawValue ?? '')}\n${context}`);
  if (parsed.value === null) {
    return { einheit: unit, confidencePenalty: unit === 'UNKLAR', invalid: parsed.invalid };
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

function normalizeMappingAmounts(result: LuminaFileAnalysisResult, files: NormalizedFileContent[]): LuminaFileAnalysisResult {
  result.mapping_vorschlag = result.mapping_vorschlag.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const mapping = { ...(item as MappingRecord) };
    const context = findContextForMapping(mapping, files);
    const normalized = normalizeAmountForAnalysis(mapping['erkannter_wert'], context);
    if (normalized.invalid) {
      addFindingOnce(result, 'Fehlerhaftes Zahlenformat erkannt – bitte prüfen.', 'Bitte den Betrag in der Quelldatei kontrollieren.');
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
    return { result: normalizeMappingAmounts(validated.data, files), model };
  } finally {
    clearTimeout(timeout);
  }
}
