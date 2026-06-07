import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
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
import { extractUploadedFiles, type UploadedMemoryFile } from './services/luminaFileExtractionService';
import { analyzeNormalizedFiles } from './services/luminaUploadAnalysisService';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadAnalysis = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 12 } });
const app    = express();
app.set('trust proxy', 1);

const DEFAULT_CORS_ORIGINS = ['https://lumina-report-to-go.vercel.app', 'http://127.0.0.1:5173', 'http://localhost:5173'];
function allowedCorsOrigins(): string[] {
  return (process.env['CORS_ORIGINS'] || DEFAULT_CORS_ORIGINS.join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedCorsOrigins().includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Pilot-Access-Code'],
}));
app.use(express.json({ limit: '2mb' }));

type RateLimitBucket = { count: number; resetAt: number };
const rateLimitBuckets = new Map<string, RateLimitBucket>();

function requirePilotAccess(req: Request, res: Response, next: NextFunction) {
  const expectedCode = process.env['PILOT_ACCESS_CODE'];
  if (!expectedCode) return next();

  const providedCode = req.header('X-Pilot-Access-Code') || '';
  if (providedCode !== expectedCode) {
    return res.status(401).json({
      error: 'Zugangscode ungueltig oder fehlt.',
      code: 'PILOT_ACCESS_REQUIRED',
    });
  }

  return next();
}

function rateLimit(name: string, maxRequests: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${name}:${ip}`;
    const current = rateLimitBuckets.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + 60 * 60 * 1000 };

    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);

    if (bucket.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Zu viele Anfragen. Bitte versuchen Sie es spaeter erneut.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds,
      });
    }

    return next();
  };
}

// ── Health ─────────────────────────────────────────────────────────
app.get('/api/health', (_: Request, res: Response) => {
  res.json({ ok: true });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'lumina-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.send('Lumina backend is running');
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

app.post('/api/ai/section-text', requirePilotAccess, async (req: Request, res: Response) => {
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
    const status = msg.includes('OPENAI_API_KEY') || msg.includes('OpenAI request failed') || msg.toLowerCase().includes('timeout') ? 503 : 500;
    return res.status(status).json({
      error: status === 503 ? `KI-Dienst aktuell nicht erreichbar: ${msg}` : msg,
      code: status === 503 ? 'AI_SERVICE_UNAVAILABLE' : 'AI_SECTION_ERROR',
    });
  }
});

// ── Import Excel ───────────────────────────────────────────────────
function importExcelHandler(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei empfangen' });
    if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
      return res.status(400).json({ error: 'Ungueltiges Dateiformat. Bitte eine .xlsx-Datei hochladen.' });
    }
    const data = importExcel(req.file.buffer);
    res.json({ data });
  } catch (err) {
    console.error('Excel import error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
}

app.post('/api/import-excel', requirePilotAccess, rateLimit('import', 30), upload.single('file'), importExcelHandler);
app.post('/api/import', requirePilotAccess, rateLimit('import', 30), upload.single('file'), importExcelHandler);

const SUPPORTED_ANALYSIS_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'xlsx',
  'xls',
  'csv',
  'txt',
  'md',
  'markdown',
  'zip',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'tif',
  'tiff',
]);

function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

app.post('/api/analyze-uploaded-files', requirePilotAccess, rateLimit('upload-analysis', 12), uploadAnalysis.array('files', 12), async (req: Request, res: Response) => {
  const files = (req.files || []) as Express.Multer.File[];
  if (!files.length) {
    return res.status(400).json({ error: 'Keine Dateien empfangen.' });
  }

  const unsupportedFiles = files.filter(file => !SUPPORTED_ANALYSIS_EXTENSIONS.has(extensionOf(file.originalname)));
  if (unsupportedFiles.length) {
    return res.status(400).json({
      error: `Nicht unterstuetzte Dateitypen: ${unsupportedFiles.map(file => file.originalname).join(', ')}`,
      code: 'UNSUPPORTED_FILE_TYPE',
    });
  }

  try {
    const normalizedFiles = extractUploadedFiles(files.map(file => ({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    } satisfies UploadedMemoryFile)));
    const extractionWarnings = normalizedFiles.flatMap(file => file.extractionWarnings.map(warning => `${file.fileName}: ${warning}`));
    const analysis = await analyzeNormalizedFiles(normalizedFiles);
    return res.json({
      normalizedFiles,
      extractionWarnings,
      analysis: analysis.result,
      model: analysis.model,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = (err as Error).message || 'Unbekannter Analysefehler';
    const lower = msg.toLowerCase();
    const status = lower.includes('openai') || lower.includes('api_key') || lower.includes('timeout') || lower.includes('abort') ? 503 : 500;
    return res.status(status).json({
      error: status === 503 ? `KI-Dienst aktuell nicht erreichbar: ${msg}` : msg,
      code: status === 503 ? 'AI_SERVICE_UNAVAILABLE' : 'UPLOAD_ANALYSIS_FAILED',
    });
  }
});

// ── Generate all three documents ───────────────────────────────────
app.post('/api/generate', requirePilotAccess, rateLimit('generate', 10), async (req: Request, res: Response) => {
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
    if (msg.includes('OPENAI_API_KEY')) {
      return res.status(503).json({ error: 'OPENAI_API_KEY fehlt auf dem Server.' });
    }
    if (msg.includes('OpenAI request failed') || msg.includes('overloaded') || msg.includes('529')) {
      return res.status(503).json({ error: `OpenAI konnte die Texte aktuell nicht erzeugen: ${msg}` });
    }
    if (msg.toLowerCase().includes('timeout')) {
      return res.status(503).json({ error: `KI-Dienst nicht erreichbar oder Timeout: ${msg}` });
    }
    if (e?.status === 401 || e?.status === 403) {
      return res.status(401).json({ error: 'OpenAI API-Key ungültig oder fehlende Berechtigung.' });
    }
    res.status(500).json({ error: msg || 'Der Jahresabschluss konnte nicht erzeugt werden. Bitte pruefen Sie die Eingaben und versuchen Sie es erneut.' });
  }
});

// ── Preview AI texts ───────────────────────────────────────────────
app.post('/api/preview-texts', requirePilotAccess, async (req: Request, res: Response) => {
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

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (!err) return next();
  const error = err as { code?: string; message?: string };
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'Datei zu gross. Bitte laden Sie kleinere Dateien hoch.',
      code: 'FILE_TOO_LARGE',
    });
  }
  return res.status(500).json({
    error: error.message || 'Die Anfrage konnte nicht verarbeitet werden.',
    code: 'REQUEST_FAILED',
  });
});

export { app };

if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}
