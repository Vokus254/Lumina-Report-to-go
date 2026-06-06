/**
 * Unit-Tests für excelImportService.js
 * Verwendet die reale Beispiel-XLSX aus tests/fixtures/example1.xlsx
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { importExcel } from '../../services/excelImportService.js';

let data;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

beforeAll(() => {
  const buf = fs.readFileSync(path.join(__dirname, '../fixtures/example1.xlsx'));
  data = importExcel(buf);
});

// ── Stammdaten ──────────────────────────────────────────────────────────────
describe('Stammdaten', () => {
  it('Firmenname importiert', () => expect(data.stammdaten.firmenname).toBe('Lumina AG'));
  it('Sitz importiert', ()       => expect(data.stammdaten.sitz).toBe('Duisburg'));
  it('Geschäftsjahr importiert', () => expect(data.stammdaten.geschaeftsjahr).toBe('2025'));
  it('5 Segmente importiert', () => expect(data.segmente).toHaveLength(5));
  it('Vorstand 3 Mitglieder',  () => expect(data.organe.vorstand).toHaveLength(3));
  it('Aufsichtsrat 3 Mitglieder', () => expect(data.organe.aufsichtsrat).toHaveLength(3));
});

// ── GuV ─────────────────────────────────────────────────────────────────────
describe('GuV – aktuelle Werte', () => {
  it('Umsatzerlöse',  () => expect(data.guv.umsatzerloese).toBe(123000));
  it('Löhne',         () => expect(data.guv.loehne).toBeCloseTo(29898, 0));
  it('Abschreibungen',() => expect(data.guv.abschreibungen).toBe(5000));
});

// ── GuV Vorjahreswerte ───────────────────────────────────────────────────────
describe('GuV – Vorjahreswerte (Kennzahlen)', () => {
  it('vorjahr_umsatz',     () => expect(data.kennzahlen.vorjahr_umsatz).toBe(100889));
  it('vj_loehne',          () => expect(data.kennzahlen.vj_loehne).toBeCloseTo(29787, 0));
  it('vj_sozialabgaben',   () => expect(data.kennzahlen.vj_sozialabgaben).toBeCloseTo(5957, 0));
  it('vj_personalaufwand', () => expect(data.kennzahlen.vj_personalaufwand).toBeCloseTo(35744, 0));
  it('vj_materialaufwand', () => expect(data.kennzahlen.vj_materialaufwand).toBe(37999));
  it('vj_abschreibungen',  () => expect(data.kennzahlen.vj_abschreibungen).toBe(4000));
  it('vorjahr_ebit',       () => expect(data.kennzahlen.vorjahr_ebit).toBeCloseTo(7215.6, 1));
  it('vorjahr_jahresueber',() => expect(data.kennzahlen.vorjahr_jahresueber).toBeCloseTo(5951, 0));
});

// ── Bilanz – aktuelle Werte ──────────────────────────────────────────────────
describe('Bilanz – aktuelle Werte', () => {
  it('immat_vw (Summe)',  () => expect(data.bilanz.immat_vw).toBe(18243));
  it('sachanlagen',       () => expect(data.bilanz.sachanlagen).toBe(11866));
  it('finanzanlagen',     () => expect(data.bilanz.finanzanlagen).toBe(17678));
  it('liquide_mittel',    () => expect(data.bilanz.liquide_mittel).toBe(6622));
  it('bilanzsumme',       () => expect(data.bilanz.bilanzsumme).toBe(106572));
});

// ── Bilanz – VJ Aktiva ───────────────────────────────────────────────────────
describe('Bilanz – VJ Aktiva (Vergleichsspalte)', () => {
  it('vj_immat_vw',        () => expect(data.bilanz.vj_immat_vw).toBe(18195));
  it('vj_sachanlagen',     () => expect(data.bilanz.vj_sachanlagen).toBe(11247));
  it('vj_finanzanlagen',   () => expect(data.bilanz.vj_finanzanlagen).toBe(16706));
  it('vj_anlagevermoegen', () => expect(data.bilanz.vj_anlagevermoegen).toBe(46148));
  it('vj_vorraete',        () => expect(data.bilanz.vj_vorraete).toBe(20018));
  it('vj_vorr_rhb',        () => expect(data.bilanz.vj_vorr_rhb).toBe(5735));
  it('vj_vorr_unfertig',   () => expect(data.bilanz.vj_vorr_unfertig).toBe(6751));
  it('vj_vorr_fertig',     () => expect(data.bilanz.vj_vorr_fertig).toBe(138));
  it('vj_vorr_anzahlungen',() => expect(data.bilanz.vj_vorr_anzahlungen).toBe(7394));
  it('vj_forderungen',     () => expect(data.bilanz.vj_forderungen).toBe(13814));
  it('vj_liquide_mittel',  () => expect(data.bilanz.vj_liquide_mittel).toBe(8750));
  it('vj_bilanzsumme',     () => expect(data.bilanz.vj_bilanzsumme).toBe(111357));
});

// ── Bilanz – VJ Passiva ──────────────────────────────────────────────────────
describe('Bilanz – VJ Passiva (Vergleichsspalte)', () => {
  it('vj_ez_kapital',            () => expect(data.bilanz.vj_ez_kapital).toBe(7534));
  it('vj_kapruecklage',          () => expect(data.bilanz.vj_kapruecklage).toBe(2229));
  it('vj_gesetzliche_ruecklage', () => expect(data.bilanz.vj_gesetzliche_ruecklage).toBe(6688));
  it('vj_andere_gewinnrueckl',   () => expect(data.bilanz.vj_andere_gewinnrueckl).toBe(7086));
  it('vj_gewinnruecklagen',      () => expect(data.bilanz.vj_gewinnruecklagen).toBe(13774));
  it('vj_bilanzgewinn',          () => expect(data.bilanz.vj_bilanzgewinn).toBeCloseTo(5951, 0));
  it('vj_eigenkapital',          () => expect(data.bilanz.vj_eigenkapital).toBeCloseTo(29488, 0));
  it('vj_pensionsrueck',         () => expect(data.bilanz.vj_pensionsrueck).toBe(8778));
  it('vj_steuerrueck',           () => expect(data.bilanz.vj_steuerrueck).toBe(7619));
  it('vj_sonstige_rueck',        () => expect(data.bilanz.vj_sonstige_rueck).toBe(11687));
  it('vj_anleihen',              () => expect(data.bilanz.vj_anleihen).toBe(4028));
  it('vj_verb_kreditinst',       () => expect(data.bilanz.vj_verb_kreditinst).toBe(6142));
  it('vj_verb_llg',              () => expect(data.bilanz.vj_verb_llg).toBe(6141));
  it('vj_passiver_rao',          () => expect(data.bilanz.vj_passiver_rao).toBe(3538));
});

// ── Negative Tests ────────────────────────────────────────────────────────────
describe('Fehlerbehandlung', () => {
  it('wirft Fehler bei leerem Buffer', () => {
    expect(() => importExcel(Buffer.alloc(0))).toThrow();
  });

  it('wirft Fehler bei Nicht-Excel-Datei', () => {
    expect(() => importExcel(Buffer.from('this is not xlsx'))).toThrow();
  });
});
