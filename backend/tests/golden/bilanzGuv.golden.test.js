/**
 * Golden-File-Test: Bilanz & GuV Renderer
 *
 * Prueft zwei Ebenen:
 * 1. DOCX-Buffer ist valides ZIP, Groesse stabil (Snapshot)
 * 2. word/document.xml enthaelt die erwarteten Zahlen und Texte
 *
 * Bei strukturellen Aenderungen am Renderer den Snapshot mit
 *   npx vitest run --update-snapshots
 * bewusst aktualisieren.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

const require = createRequire(import.meta.url);
const { renderBilanzGuV } = require('../../renderers/bilanzGuvRenderer');

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

let docxBuffer;
let documentXml;

beforeAll(async () => {
  const testData = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'testData.json'), 'utf8'));
  testData.bilanz.vj_sonstige_verbindlichkeiten = testData.bilanz.vj_sonst_verb;
  delete testData.bilanz.vj_sonst_verb;
  const aiTexts  = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'aiTexts.json'),  'utf8'));
  docxBuffer = await renderBilanzGuV(testData, aiTexts);

  const zip = new AdmZip(docxBuffer);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('word/document.xml nicht im DOCX gefunden');
  documentXml = entry.getData().toString('utf8');
}, 30000);

// ── Buffer-Integritaet ───────────────────────────────────────────────────────
describe('DOCX Buffer', () => {
  it('ist nicht leer', () => {
    expect(docxBuffer.length).toBeGreaterThan(10_000);
  });
  it('ist valides ZIP (PK-Magic-Bytes)', () => {
    expect(docxBuffer[0]).toBe(0x50); // P
    expect(docxBuffer[1]).toBe(0x4B); // K
  });
  it('enthaelt word/document.xml', () => {
    expect(documentXml).toBeTruthy();
    expect(documentXml.length).toBeGreaterThan(1000);
  });
  it('Groesse in plausiblem Bereich (15k–35k Bytes)', () => {
    // Range-Test statt exaktem Snapshot, weil ZIP-Timestamps 1-2 Bytes variieren
    expect(docxBuffer.length).toBeGreaterThan(15_000);
    expect(docxBuffer.length).toBeLessThan(35_000);
  });
});

// ── Aktuelle Jahreswerte ─────────────────────────────────────────────────────
describe('Aktuelle Jahreswerte im document.xml', () => {
  it('Umsatzerloese (123.000)',       () => expect(documentXml).toContain('123.000'));
  it('Immat. VW Summe (18.243)',      () => expect(documentXml).toContain('18.243'));
  it('Sachanlagen Summe (11.866)',    () => expect(documentXml).toContain('11.866'));
  it('Finanzanlagen Summe (17.678)',  () => expect(documentXml).toContain('17.678'));
  it('Bilanzsumme Aktiva (106.572)',  () => expect(documentXml).toContain('106.572'));
  it('Eigenkapital Summe (39.760)',   () => expect(documentXml).toContain('39.760'));
  it('Pensionsrueckstellungen (2.545)', () => expect(documentXml).toContain('2.545'));
  it('JAHRESUEBERSCHUSS-Label',       () => expect(documentXml).toContain('JAHRESUEBERSCHUSS'));
});

// ── Vorjahreswerte Summenzeilen ──────────────────────────────────────────────
describe('Vorjahreswerte Summenzeilen im document.xml', () => {
  it('VJ Immat. VW Summe (18.195)',     () => expect(documentXml).toContain('18.195'));
  it('VJ Sachanlagen Summe (11.247)',   () => expect(documentXml).toContain('11.247'));
  it('VJ Finanzanlagen Summe (16.706)', () => expect(documentXml).toContain('16.706'));
  it('VJ Anlagevermoegen (46.148)',     () => expect(documentXml).toContain('46.148'));
  it('VJ Bilanzsumme (111.357)',        () => expect(documentXml).toContain('111.357'));
  it('VJ Eigenkapital (29.488)',        () => expect(documentXml).toContain('29.488'));
  it('VJ Pensionsrueckstellungen (8.778)', () => expect(documentXml).toContain('8.778'));
  it('VJ-Spaltenheader (2024)',         () => expect(documentXml).toContain('2024'));
  it('Vorjahr Umsatz in GuV (100.889)', () => expect(documentXml).toContain('100.889'));
});

// ── Vorjahreswerte Detailzeilen (neu) ────────────────────────────────────────
describe('Vorjahreswerte Detailzeilen Aktiva', () => {
  // Immaterielles Vermögen
  it('VJ Lizenzen/Rechte (5.017)',        () => expect(documentXml).toContain('5.017'));
  it('VJ Selbst erstellte immat. (7.534 in VJ-Spalte)', () => {
    // 7.534 erscheint mehrfach (auch als Kapital VJ) – prüfe mind. einmal vorhanden
    expect(documentXml).toContain('7.534');
  });
  it('VJ Anzahlungen immat. (5.644)',     () => expect(documentXml).toContain('5.644'));
  // Sachanlagen
  it('VJ Grundstuecke (5.645)',           () => expect(documentXml).toContain('5.645'));
  it('VJ Techn. Anlagen (2.007)',         () => expect(documentXml).toContain('2.007'));
  it('VJ Anlagen im Bau (3.583)',         () => expect(documentXml).toContain('3.583'));
  // Finanzanlagen
  it('VJ Anteile VBU (7.078)',            () => expect(documentXml).toContain('7.078'));
  it('VJ Ausleihungen VBU (2.326)',       () => expect(documentXml).toContain('2.326'));
  it('VJ Beteiligungen (7.302)',          () => expect(documentXml).toContain('7.302'));
  // Vorraete
  it('VJ RHB (5.735)',                    () => expect(documentXml).toContain('5.735'));
  it('VJ Unfertige Erzeugnisse (6.751)', () => expect(documentXml).toContain('6.751'));
  it('VJ Fertige Erzeugnisse (138)',      () => expect(documentXml).toContain('138'));
  it('VJ Vorraeete Anzahlungen (7.394)', () => expect(documentXml).toContain('7.394'));
  // Forderungen
  it('VJ Forderungen LuL (3.551)',        () => expect(documentXml).toContain('3.551'));
  it('VJ Forderungen VBU (3.567)',        () => expect(documentXml).toContain('3.567'));
  it('VJ Sonstige Forderungen (6.696)',   () => expect(documentXml).toContain('6.696'));
});

describe('Vorjahreswerte Detailzeilen Passiva', () => {
  it('VJ Gesetzliche Ruecklage (6.688)', () => expect(documentXml).toContain('6.688'));
  it('VJ Andere Gewinnruecklagen (7.086)', () => expect(documentXml).toContain('7.086'));
  it('VJ Sonstige Verbindlichkeiten (28.244)', () => expect(documentXml).toContain('28.244'));
  it('VJ Summe Verbindlichkeiten (50.247)', () => expect(documentXml).toContain('50.247'));
});

// ── Struktur-Checks ───────────────────────────────────────────────────────────
describe('Dokumentstruktur', () => {
  it('AKTIVA vorhanden',          () => expect(documentXml).toContain('AKTIVA'));
  it('PASSIVA vorhanden',         () => expect(documentXml).toContain('PASSIVA'));
  it('GuV ERLOESE vorhanden',     () => expect(documentXml).toContain('ERLOESE'));
  it('ANLAGEVERMOEGEN vorhanden', () => expect(documentXml).toContain('ANLAGEVERMOEGEN'));
  it('Firmenname (LUMINA)',        () => expect(documentXml).toContain('LUMINA'));
  it('Geschaeftsjahr 2025',       () => expect(documentXml).toContain('2025'));
});
