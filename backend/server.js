require('dotenv').config();

if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('IHREN-KEY')) {
  console.error('FEHLER: ANTHROPIC_API_KEY ist nicht gesetzt. Bitte in backend/.env eintragen.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const archiver = require('archiver');
const multer = require('multer');
const { generateTexts } = require('./services/aiTextService');
const { renderLagebericht } = require('./renderers/lageberichtRenderer');
const { renderBilanzGuV } = require('./renderers/bilanzGuvRenderer');
const { renderAnhang } = require('./renderers/anhangRenderer');
const { importExcel } = require('./services/excelImportService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json({ limit: '2mb' }));

// ── Health ────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true }));

// ── Import Excel template ─────────────────────────────────────────
app.post('/api/import-excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei empfangen' });
    console.log(`Excel import: "${req.file.originalname}", ${req.file.size} Bytes`);
    const data = importExcel(req.file.buffer);
    const fieldCount = Object.keys(data.stammdaten).length
      + Object.keys(data.guv).length
      + Object.keys(data.bilanz).length;
    console.log(`Excel import erfolgreich: ~${fieldCount} Felder gemappt`);
    res.json({ data });
  } catch (err) {
    console.error('Excel import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Generate all three documents ─────────────────────────────────
app.post('/api/generate', async (req, res) => {
  try {
    const data = req.body;

    // ── Serverseitige Validierung ─────────────────────────────────
    const errors = [];
    if (!data?.stammdaten?.firmenname?.trim())
      errors.push('Firmenname fehlt (Stammdaten).');
    if (!data?.stammdaten?.geschaeftsjahr)
      errors.push('Geschäftsjahr fehlt (Stammdaten).');
    const guv = data?.guv || {};
    if (!guv.umsatzerloese || guv.umsatzerloese === 0)
      errors.push('Umsatzerlöse fehlen (GuV).');
    const bilanz = data?.bilanz || {};
    const aktivSumme = (bilanz.immat_vw||0) + (bilanz.sachanlagen||0) + (bilanz.finanzanlagen||0)
      + (bilanz.vorraete||0) + (bilanz.forderungen_gesamt||0)
      + (bilanz.wertpapiere_umlauf||0) + (bilanz.liquide_mittel||0)
      + (bilanz.aktiver_rao||0) + (bilanz.aktive_latente_steuern||0);
    const ekSumme = (bilanz.gezeichnetes_kapital||0) + (bilanz.kapitalruecklage||0)
      + (bilanz.gesetzliche_ruecklage||0) + (bilanz.andere_gewinnruecklagen||0) + (bilanz.bilanzgewinn||0);
    const rueckSumme = (bilanz.pensionsrueckstellungen||0) + (bilanz.steuerrueckstellungen||0) + (bilanz.sonstige_rueckstellungen||0);
    const verbSumme = (bilanz.anleihen||0) + (bilanz.verbindlichkeiten_kreditinstitute||0)
      + (bilanz.verbindlichkeiten_llg||0) + (bilanz.verbindlichkeiten_vbu||0)
      + (bilanz.sonstige_verbindlichkeiten||0) + (bilanz.erhaltene_anzahlungen||0);
    const passivSumme = ekSumme + rueckSumme + verbSumme + (bilanz.passiver_rao||0);
    if (aktivSumme > 0 && Math.abs(aktivSumme - passivSumme) > 1)
      errors.push(`Bilanz nicht ausgeglichen: Aktiva ${aktivSumme.toFixed(0)} TEUR ≠ Passiva ${passivSumme.toFixed(0)} TEUR (Differenz: ${(aktivSumme - passivSumme).toFixed(0)} TEUR).`);
    if (errors.length > 0)
      return res.status(422).json({ error: 'Validierungsfehler', details: errors });
    console.log('Generating AI texts...');
    const texts = await generateTexts(data);
    console.log('Rendering documents...');
    const [lageberichtBuf, bilanzBuf, anhangBuf] = await Promise.all([
      renderLagebericht(data, texts),
      renderBilanzGuV(data, texts),
      renderAnhang(data, texts),
    ]);
    const company = (data.stammdaten.firmenname || 'Jahresabschluss')
      .replace(/[\s/\\":*?<>|]+/g, '_')   // alle gefährlichen Zeichen ersetzen
      .replace(/_{2,}/g, '_')               // mehrfache Underscores zusammenführen
      .replace(/^_|_$/g, '')               // führende/trailing Underscores entfernen
      .slice(0, 80);                        // Länge begrenzen
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
    res.status(500).json({ error: err.message });
  }
});

// ── Preview AI texts ─────────────────────────────────────────────
app.post('/api/preview-texts', async (req, res) => {
  try {
    const texts = await generateTexts(req.body);
    res.json({ texts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
