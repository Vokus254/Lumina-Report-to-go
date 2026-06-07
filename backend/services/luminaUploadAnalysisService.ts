import { LuminaFileAnalysisResultSchema, type LuminaFileAnalysisResult, type NormalizedFileContent } from '../../packages/schema/src';
import { LUMINA_UPLOAD_SYSTEM_PROMPT } from './luminaUploadPrompt';

const DEFAULT_MODEL = 'gpt-4.1-mini';
const OPENAI_TIMEOUT_MS = 60000;

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
    return { result: validated.data, model };
  } finally {
    clearTimeout(timeout);
  }
}
