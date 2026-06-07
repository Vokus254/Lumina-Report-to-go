import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import archiver from 'archiver';
import multer from 'multer';
import { JahresabschlussSchema } from '../packages/schema/src';
import { generateTexts } from './services/aiTextService';
import { renderLagebericht } from './renderers/lageberichtRenderer';
import { renderBilanzGuV }   from './renderers/bilanzGuvRenderer';
import { renderAnhang }      from './renderers/anhangRenderer';
import { importExcel }       from './services/excelImportService';
import { generateSectionText, generateSectionTextsForAnhang } from './services/openAiSectionTextService';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const app    = express();

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json({ limit: '2mb' }));

// ── Health ─────────────────────────────────────────────────────────
app.get('/api/health', (_: Request, res: Response) => {
  res.json({ ok: true });
});

type SectionTextRequestBody = {
  sectionId: string;
  title: string;
  facts: Record<string, unknown>;
  requirements: string[];
  style?: string;
  role?: string;
  scope?: 'kurz' | 'mittel' | 'ausführlich';
  temperature?: number;
  customPrompt?: string;
};

function parseTemperature(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseSectionTextRequest(body: unknown): SectionTextRequestBody | null {
  const data = body as Partial<SectionTextRequestBody>;
  const factsValid = data?.facts != null && typeof data.facts === 'object' && !Array.isArray(data.facts);
  const requirementsValid = Array.isArray(data?.requirements) && data.requirements.every(item => typeof item === 'string');
  const styleValid = data?.style === undefined || typeof data.style === 'string';
  const roleValid = data?.role === undefined || typeof data.role === 'string';
  const scopeValid = data?.scope === undefined || data.scope === 'kurz' || data.scope === 'mittel' || data.scope === 'ausführlich';
  const temperature = parseTemperature((data as { temperature?: unknown })?.temperature);
  const temperatureValid = (data as { temperature?: unknown })?.temperature === undefined || temperature !== undefined;
  const customPromptValid = data?.customPrompt === undefined || typeof data.customPrompt === 'string';

  if (
    typeof data?.sectionId !== 'string' ||
    typeof data.title !== 'string' ||
    !factsValid ||
    !requirementsValid ||
    !styleValid ||
    !roleValid ||
    !scopeValid ||
    !temperatureValid ||
    !customPromptValid
  ) {
    return null;
  }

  return {
    sectionId: data.sectionId,
    title: data.title,
    facts: data.facts as Record<string, unknown>,
    requirements: data.requirements as string[],
    style: data.style ?? '',
    role: data.role,
    scope: data.scope,
    temperature,
    customPrompt: data.customPrompt,
  };
}

app.post('/api/ai/section-text', async (req: Request, res: Response) => {
  const parsed = parseSectionTextRequest(req.body);
  if (!parsed) {
    return res.status(422).json({ error: 'Ungueltige Eingabedaten fuer Abschnittstext.' });
  }

  try {
    const facts = Object.entries(parsed.facts).map(([key, value]) => `${key}: ${String(value)}`);
    const sectionInput = {
      sectionId: parsed.sectionId,
      title: parsed.title,
      facts,
      missingInputs: parsed.requirements,
      style: parsed.style,
    };
    if (parsed.role !== undefined) Object.assign(sectionInput, { role: parsed.role });
    if (parsed.scope !== undefined) Object.assign(sectionInput, { scope: parsed.scope });
    if (parsed.temperature !== undefined) Object.assign(sectionInput, { temperature: parsed.temperature });
    if (parsed.customPrompt !== undefined) Object.assign(sectionInput, { customPrompt: parsed.customPrompt });

    const output = await generateSectionText(sectionInput);
    return res.json(output);
  } catch (err) {
    const msg = (err as Error).message || 'Unbekannter KI-Fehler';
    const status = msg.includes('OPENAI_API_KEY') || msg.includes('OpenAI request failed') ? 503 : 500;
    return res.status(status).json({ error: msg });
  }
});

// ── Import Excel ───────────────────────────────────────────────────
app.post('/api/import-excel', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei empfangen' });
    const data = importExcel(req.file.buffer);
    res.json({ data });
  } catch (err) {
    console.error('Excel import error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Generate all three documents ───────────────────────────────────
app.post('/api/generate', async (req: Request, res: Response) => {
  // Zod-Validierung des Request-Body
  const parsed = JahresabschlussSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      error: 'Ungültige Eingabedaten',
      details: parsed.error.flatten(),
    });
  }

  try {
    const rawBody = req.body as { reportTexts?: unknown; kennzahlen?: unknown };
    const rawReportTexts = rawBody.reportTexts;
    const hasReportTexts = rawReportTexts && typeof rawReportTexts === 'object' && !Array.isArray(rawReportTexts) && Object.keys(rawReportTexts).length > 0;
    const rawKennzahlen = rawBody.kennzahlen && typeof rawBody.kennzahlen === 'object' && !Array.isArray(rawBody.kennzahlen)
      ? rawBody.kennzahlen as Record<string, unknown>
      : {};
    const preservedKennzahlen = Object.fromEntries(
      ['vj_material_roh', 'vj_material_dienst', 'vj_sonstige_aufwend', 'vj_sonstige_aufwendungen']
        .filter(key => typeof rawKennzahlen[key] === 'number')
        .map(key => [key, rawKennzahlen[key]])
    );
    const data = hasReportTexts
      ? { ...parsed.data, kennzahlen: { ...parsed.data.kennzahlen, ...preservedKennzahlen }, reportTexts: rawReportTexts } as typeof parsed.data
      : { ...parsed.data, kennzahlen: { ...parsed.data.kennzahlen, ...preservedKennzahlen } } as typeof parsed.data;
    console.log('Generating AI texts...');
    const texts = await generateTexts(data);
    const sectionTexts = hasReportTexts ? {} : await generateSectionTextsForAnhang(data);
    console.log('Rendering documents...');
    const [lageberichtBuf, bilanzBuf, anhangBuf] = await Promise.all([
      renderLagebericht(data, texts),
      renderBilanzGuV(data, texts),
      renderAnhang(data, texts, sectionTexts),
    ]);
    const company = (data.stammdaten.firmenname || 'Jahresabschluss').replace(/\s+/g, '_');
    const year    = data.stammdaten.geschaeftsjahr || '2025';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${company}_Jahresabschluss_${year}.zip"`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);
    archive.append(lageberichtBuf, { name: `${company}_Lagebericht_${year}.docx` });
    archive.append(bilanzBuf,      { name: `${company}_Bilanz_GuV_${year}.docx` });
    archive.append(anhangBuf,      { name: `${company}_Anhang_${year}.docx` });
    await archive.finalize();
  } catch (err) {
    console.error('Generation error:', err);
    const e = err as { status?: number; message?: string };
    const msg = String(e?.message ?? '');
    if (e?.status === 529 || msg.includes('overloaded') || msg.includes('529')) {
      return res.status(503).json({ error: 'Claude ist aktuell überlastet. Bitte in einigen Minuten erneut versuchen.' });
    }
    if (e?.status === 401 || e?.status === 403) {
      return res.status(401).json({ error: 'Claude API-Key ungültig oder fehlende Berechtigung.' });
    }
    if (msg.includes('OpenAI request failed') || msg.includes('OPENAI_API_KEY')) {
      return res.status(503).json({ error: `Abschnittstexte konnten nicht erzeugt werden: ${msg}` });
    }
    res.status(500).json({ error: msg || 'Unbekannter Fehler' });
  }
});

// ── Preview AI texts ───────────────────────────────────────────────
app.post('/api/preview-texts', async (req: Request, res: Response) => {
  const parsed = JahresabschlussSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: 'Ungültige Eingabedaten', details: parsed.error.flatten() });
  }
  try {
    const texts = await generateTexts(parsed.data);
    res.json({ texts });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export { app };

if (require.main === module) {
  const port = process.env['PORT'] || 3001;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}
