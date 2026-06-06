/**
 * Golden-File-Test: Lagebericht Renderer
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

const require = createRequire(import.meta.url);
const { renderLagebericht } = require('../../renderers/lageberichtRenderer');

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

let docxBuffer;
let documentXml;

beforeAll(async () => {
  const testData = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'testData.json'), 'utf8'));
  const aiTexts  = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'aiTexts.json'),  'utf8'));
  docxBuffer = await renderLagebericht(testData, aiTexts);

  const zip   = new AdmZip(docxBuffer);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('word/document.xml nicht im DOCX gefunden');
  documentXml = entry.getData().toString('utf8');
}, 30000);

describe('Lagebericht DOCX Buffer', () => {
  it('ist nicht leer', () => expect(docxBuffer.length).toBeGreaterThan(5_000));
  it('ist valides ZIP', () => {
    expect(docxBuffer[0]).toBe(0x50);
    expect(docxBuffer[1]).toBe(0x4B);
  });
  it('Groesse in plausiblem Bereich (10k–30k Bytes)', () => {
    expect(docxBuffer.length).toBeGreaterThan(10_000);
    expect(docxBuffer.length).toBeLessThan(30_000);
  });
});

describe('Lagebericht Inhalt', () => {
  it('Firmenname (Lumina AG)',                 () => expect(documentXml).toContain('Lumina AG'));
  it('KPI-Tabelle: Umsatz (123.000)',          () => expect(documentXml).toContain('123.000'));
  it('Vorjahr Umsatz in KPI-Tabelle (100.889)', () => expect(documentXml).toContain('100.889'));
  it('Mitarbeiter (345)',                      () => expect(documentXml).toContain('345'));
  it('Geschaeftsjahr 2025',                   () => expect(documentXml).toContain('2025'));
  it('Abschnitt Grundlagen',                  () => expect(documentXml).toContain('Grundlagen'));
  it('Abschnitt Risiken',                     () => expect(documentXml).toContain('Risiken'));
});
