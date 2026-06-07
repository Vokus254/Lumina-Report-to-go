import AdmZip from 'adm-zip';
import XLSX from 'xlsx';
import type { NormalizedFileContent } from '../../packages/schema/src';

export type UploadedMemoryFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown']);
const EXCEL_EXTENSIONS = new Set(['xlsx', 'xls']);
const CSV_EXTENSIONS = new Set(['csv']);

function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function baseContent(fileName: string, fileType: string, warnings: string[] = []): NormalizedFileContent {
  return {
    fileName,
    fileType,
    detectedContentType: 'unbekannt',
    textContent: '',
    tables: [],
    sheets: [],
    pages: [],
    metadata: {},
    extractionWarnings: warnings,
    confidence: 0,
  };
}

function decodeText(buffer: Buffer): string {
  return buffer.toString('utf8').replace(/\u0000/g, '').trim();
}

function trimEmptyRows(rows: unknown[][]): unknown[][] {
  return rows.filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''));
}

function detectContentType(fileName: string, text: string): string {
  const haystack = `${fileName}\n${text}`.toLowerCase();
  if (/summen|salden|susa|kontennachweis/.test(haystack)) return 'SuSa / Kontennachweis';
  if (/bilanz|aktiva|passiva|eigenkapital/.test(haystack)) return 'Bilanz';
  if (/\bguv\b|gewinn.*verlust|umsatzerl/.test(haystack)) return 'GuV';
  if (/anhang|bewertungsmethoden/.test(haystack)) return 'Anhang';
  if (/lagebericht|prognosebericht/.test(haystack)) return 'Lagebericht';
  if (/stammdaten|handelsregister|geschäftsführer|geschaeftsfuehrer/.test(haystack)) return 'Stammdaten';
  return 'unbekannt';
}

function extractExcel(file: UploadedMemoryFile): NormalizedFileContent {
  const warnings: string[] = [];
  const workbook = XLSX.read(file.buffer, { type: 'buffer', cellFormula: true, cellDates: false });
  const sheets = workbook.SheetNames.map(name => {
    const worksheet = workbook.Sheets[name];
    const rows = trimEmptyRows(XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as unknown[][]);
    const text = rows.map(row => row.map(cell => String(cell ?? '')).join(';')).join('\n');
    return { name, rows: rows.slice(0, 250), text: text.slice(0, 12000) };
  }).filter(sheet => sheet.rows.length > 0);

  if (sheets.length === 0) warnings.push('Excel enthält keine verwertbaren Tabellen.');
  const textContent = sheets.map(sheet => `=== Tabellenblatt: ${sheet.name} ===\n${sheet.text}`).join('\n\n');
  return {
    ...baseContent(file.originalname, extensionOf(file.originalname), warnings),
    detectedContentType: detectContentType(file.originalname, textContent),
    textContent,
    sheets,
    metadata: { sheetCount: workbook.SheetNames.length },
    confidence: textContent ? 0.9 : 0.2,
  };
}

function extractTextLike(file: UploadedMemoryFile): NormalizedFileContent {
  const textContent = decodeText(file.buffer);
  const warnings = textContent ? [] : ['Textdatei enthält keinen lesbaren Inhalt.'];
  return {
    ...baseContent(file.originalname, extensionOf(file.originalname), warnings),
    detectedContentType: detectContentType(file.originalname, textContent),
    textContent,
    metadata: { encoding: 'utf8' },
    confidence: textContent ? 0.85 : 0.2,
  };
}

function extractPdf(file: UploadedMemoryFile): NormalizedFileContent {
  const textCandidate = decodeText(file.buffer)
    .replace(/[^\S\r\n]+/g, ' ')
    .split(/\r?\n/)
    .filter(line => /[A-Za-zÄÖÜäöüß0-9]{3,}/.test(line))
    .slice(0, 800)
    .join('\n');
  const warnings = [
    'PDF-Extraktion ist derzeit textbasiert vorbereitet; komplexe Tabellen können unvollständig sein.',
  ];
  if (!textCandidate || textCandidate.length < 80) {
    warnings.push('PDF ist vermutlich ein Scan oder nicht textlesbar. OCR/Vision erforderlich.');
  }
  return {
    ...baseContent(file.originalname, 'pdf', warnings),
    detectedContentType: detectContentType(file.originalname, textCandidate),
    textContent: textCandidate,
    pages: textCandidate ? [{ pageNumber: 1, text: textCandidate.slice(0, 12000), tables: [] }] : [],
    metadata: { extractionMode: 'best-effort-text' },
    confidence: textCandidate.length > 80 ? 0.45 : 0.1,
  };
}

function extractDocx(file: UploadedMemoryFile): NormalizedFileContent {
  const warnings: string[] = [];
  try {
    const zip = new AdmZip(file.buffer);
    const entry = zip.getEntry('word/document.xml');
    if (!entry) {
      return {
        ...baseContent(file.originalname, 'docx', ['DOCX enthält kein word/document.xml.']),
        confidence: 0.1,
      };
    }
    const xml = entry.getData().toString('utf8');
    const textContent = xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
    if (!textContent) warnings.push('Word-Datei enthält keinen lesbaren Text.');
    return {
      ...baseContent(file.originalname, 'docx', warnings),
      detectedContentType: detectContentType(file.originalname, textContent),
      textContent,
      metadata: { extractionMode: 'documentXml' },
      confidence: textContent ? 0.8 : 0.2,
    };
  } catch (err) {
    return {
      ...baseContent(file.originalname, 'docx', [`Word-Datei nicht lesbar: ${(err as Error).message}`]),
      confidence: 0.1,
    };
  }
}

function imagePlaceholder(file: UploadedMemoryFile): NormalizedFileContent {
  return {
    ...baseContent(file.originalname, extensionOf(file.originalname), ['OCR/Vision erforderlich. Bild wurde registriert, aber noch nicht ausgelesen.']),
    detectedContentType: 'Bild / Screenshot',
    metadata: { mimetype: file.mimetype, size: file.size },
    confidence: 0.1,
  };
}

function unsupported(file: UploadedMemoryFile): NormalizedFileContent {
  const ext = extensionOf(file.originalname) || file.mimetype || 'unbekannt';
  return {
    ...baseContent(file.originalname, ext, [`Dateityp ${ext} wird derzeit nicht unterstützt.`]),
    metadata: { mimetype: file.mimetype, size: file.size },
    confidence: 0,
  };
}

function normalizeChildFile(name: string, buffer: Buffer): UploadedMemoryFile {
  return {
    originalname: name,
    mimetype: '',
    size: buffer.length,
    buffer,
  };
}

function extractZip(file: UploadedMemoryFile): NormalizedFileContent {
  const warnings: string[] = [];
  const children: NormalizedFileContent[] = [];
  try {
    const zip = new AdmZip(file.buffer);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const childName = entry.entryName;
      const child = normalizeChildFile(childName, entry.getData());
      const extracted = extractOne(child);
      children.push(extracted);
      warnings.push(...extracted.extractionWarnings.map(warning => `${childName}: ${warning}`));
    }
  } catch (err) {
    warnings.push(`ZIP konnte nicht entpackt werden: ${(err as Error).message}`);
  }
  const textContent = children.map(child => `=== ${child.fileName} ===\n${child.textContent}`).join('\n\n');
  return {
    ...baseContent(file.originalname, 'zip', warnings),
    detectedContentType: 'ZIP mit mehreren Dateien',
    textContent,
    children,
    metadata: { childCount: children.length },
    confidence: children.length ? 0.75 : 0.1,
  };
}

export function extractOne(file: UploadedMemoryFile): NormalizedFileContent {
  const ext = extensionOf(file.originalname);
  try {
    if (EXCEL_EXTENSIONS.has(ext)) return extractExcel(file);
    if (CSV_EXTENSIONS.has(ext) || TEXT_EXTENSIONS.has(ext)) return extractTextLike(file);
    if (ext === 'pdf') return extractPdf(file);
    if (ext === 'docx') return extractDocx(file);
    if (ext === 'zip') return extractZip(file);
    if (IMAGE_EXTENSIONS.has(ext)) return imagePlaceholder(file);
    return unsupported(file);
  } catch (err) {
    return {
      ...baseContent(file.originalname, ext, [`Datei nicht lesbar: ${(err as Error).message}`]),
      confidence: 0.1,
    };
  }
}

export function extractUploadedFiles(files: UploadedMemoryFile[]): NormalizedFileContent[] {
  return files.map(extractOne);
}
