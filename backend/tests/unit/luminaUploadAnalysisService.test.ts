import { describe, expect, it } from 'vitest';
import { normalizeAmountForAnalysis, normalizeMissingDisclosureRequirements } from '../../services/luminaUploadAnalysisService';
import { LuminaFileAnalysisResultSchema, type LuminaFileAnalysisResult } from '../../../packages/schema/src';

function buildAnalysis(overrides: Partial<LuminaFileAnalysisResult> = {}): LuminaFileAnalysisResult {
  return LuminaFileAnalysisResultSchema.parse({
    analyse_status: {
      gesamtbeurteilung: 'Bilanz und GuV erkannt',
      datenqualitaet: 'mittel',
      abschlussfaehigkeit: 'teilweise',
      kurzbegruendung: 'Anhang und Lagebericht fehlen.',
    },
    dateien: [],
    gesellschaft: { name: { wert: 'Test GmbH', quelle: 'Datei', confidence: 0.9 }, organe: [] },
    erkannte_abschlussbestandteile: {
      bilanz: true,
      guv: true,
      susa: true,
      kontennachweis: true,
      anhang: false,
      lagebericht: false,
    },
    bilanz: {
      aktiva: [],
      passiva: [],
      bilanzsumme_aktiva: null,
      bilanzsumme_passiva: null,
      differenz: null,
      plausibel: null,
    },
    guv: {
      verfahren: 'unbekannt',
      positionen: [],
      jahresergebnis: null,
      plausibel: null,
    },
    mapping_vorschlag: [],
    auffaelligkeiten: [],
    fehlende_angaben: [{
      prioritaet: 'zwingend',
      bereich: 'Lagebericht',
      fehlende_angabe: 'Lagebericht fehlt',
      warum_erforderlich: 'Pauschal als erforderlich eingestuft.',
      beispiel_nachfrage_an_nutzer: 'Bitte Lagebericht hochladen.',
    }],
    naechste_schritte: [],
    fragen_an_nutzer: [],
    ...overrides,
  });
}

describe('normalizeAmountForAnalysis', () => {
  it('multipliziert TEUR-Beträge mit 1.000', () => {
    const result = normalizeAmountForAnalysis(362, 'Sonstige Rückstellungen TEUR 362');

    expect(result).toMatchObject({
      original_wert: 'TEUR 362',
      erkannter_wert_eur: 362000,
      einheit: 'TEUR',
      confidencePenalty: false,
      invalid: false,
    });
  });

  it('erkennt T€ als TEUR', () => {
    const result = normalizeAmountForAnalysis('1.234,50', 'Betrag T€ 1.234,50');

    expect(result.erkannter_wert_eur).toBe(1234500);
    expect(result.einheit).toBe('TEUR');
  });

  it('erkennt in Tausend Euro als TEUR', () => {
    const result = normalizeAmountForAnalysis('775', 'Alle Beträge sind in Tausend Euro angegeben.');

    expect(result.erkannter_wert_eur).toBe(775000);
    expect(result.einheit).toBe('TEUR');
  });

  it('lässt EUR-Beträge unverändert', () => {
    const result = normalizeAmountForAnalysis('1.234.567,89 EUR', 'Forderungen 1.234.567,89 EUR');

    expect(result.erkannter_wert_eur).toBe(1234567.89);
    expect(result.einheit).toBe('EUR');
  });

  it('markiert fehlerhafte Zahlenformate', () => {
    const result = normalizeAmountForAnalysis('775,52238,14', 'Betrag 775,52238,14 EUR');

    expect(result.invalid).toBe(true);
    expect(result.erkannter_wert_eur).toBeUndefined();
  });

  it('markiert zusammengeklebte EUR-Betraege mit zwei Dezimaltrennern', () => {
    const result = normalizeAmountForAnalysis('EUR 93.774,7519.664,87', 'Forderungen EUR 93.774,7519.664,87');

    expect(result.invalid).toBe(true);
    expect(result.erkannter_wert_eur).toBeUndefined();
    expect(result.original_wert).toBe('EUR 93.774,7519.664,87');
    expect(result.hinweis).toBe('Zahl nicht eindeutig lesbar – bitte prüfen.');
  });

  it('markiert zusammengeklebte Millionenbetraege', () => {
    const result = normalizeAmountForAnalysis('EUR 2.279.146,553.051.992,66', 'Betrag EUR 2.279.146,553.051.992,66');

    expect(result.invalid).toBe(true);
    expect(result.erkannter_wert_eur).toBeUndefined();
  });

  it('markiert Zahlen mit zu langer Nachkommensequenz', () => {
    const result = normalizeAmountForAnalysis('EUR 775,52238', 'Betrag EUR 775,52238');

    expect(result.invalid).toBe(true);
    expect(result.erkannter_wert_eur).toBeUndefined();
    expect(result.confidencePenalty).toBe(true);
  });

  it('reduziert Sicherheit bei unklarer Einheit', () => {
    const result = normalizeAmountForAnalysis('362', 'Sonstige Rückstellungen 362');

    expect(result.erkannter_wert_eur).toBe(362);
    expect(result.einheit).toBe('UNKLAR');
    expect(result.confidencePenalty).toBe(true);
  });
});

describe('LuminaFileAnalysisResultSchema', () => {
  const baseAnalysis = {
    analyse_status: {
      gesamtbeurteilung: 'Anhangentwurf erkannt',
      datenqualitaet: 'mittel',
      abschlussfaehigkeit: 'teilweise',
      kurzbegruendung: 'Keine vollstaendige Bilanz oder GuV vorhanden.',
    },
    dateien: [],
    gesellschaft: { organe: [] },
    erkannte_abschlussbestandteile: {},
    bilanz: {
      aktiva: [],
      passiva: [],
      bilanzsumme_aktiva: null,
      bilanzsumme_passiva: null,
      differenz: null,
      plausibel: null,
    },
    guv: {
      verfahren: 'unbekannt',
      positionen: [],
      jahresergebnis: null,
      plausibel: null,
    },
    mapping_vorschlag: [],
    auffaelligkeiten: [],
    fehlende_angaben: [],
    naechste_schritte: [],
    fragen_an_nutzer: [],
  };

  it('akzeptiert null fuer bilanz.plausibel', () => {
    const result = LuminaFileAnalysisResultSchema.safeParse({
      ...baseAnalysis,
      bilanz: { ...baseAnalysis.bilanz, plausibel: null },
      guv: { ...baseAnalysis.guv, plausibel: false },
    });

    expect(result.success).toBe(true);
  });

  it('akzeptiert null fuer guv.plausibel', () => {
    const result = LuminaFileAnalysisResultSchema.safeParse({
      ...baseAnalysis,
      bilanz: { ...baseAnalysis.bilanz, plausibel: true },
      guv: { ...baseAnalysis.guv, plausibel: null },
    });

    expect(result.success).toBe(true);
  });
});

describe('normalizeMissingDisclosureRequirements', () => {
  it('stuft fehlenden Lagebericht bei kleiner GmbH nicht als zwingend ein', () => {
    const analysis = buildAnalysis({
      gesellschaft: {
        name: { wert: 'Kleine Test GmbH', quelle: 'Datei', confidence: 0.9 },
        rechtsform: { wert: 'GmbH', quelle: 'Datei', confidence: 0.9 },
        groessenklasse: { wert: 'kleine Kapitalgesellschaft', quelle: 'Datei', confidence: 0.8 },
        organe: [],
      },
    });

    const result = normalizeMissingDisclosureRequirements(analysis);
    const lagebericht = result.fehlende_angaben.find(item => item.bereich === 'Lagebericht');

    expect(lagebericht?.prioritaet).not.toBe('zwingend');
    expect(lagebericht?.prioritaet).toBe('optional');
    expect(lagebericht?.warum_erforderlich).toContain('nicht zwingend');
  });

  it('stuft fehlenden Lagebericht bei mittelgrosser GmbH als zwingend ein', () => {
    const analysis = buildAnalysis({
      gesellschaft: {
        name: { wert: 'Mittel GmbH', quelle: 'Datei', confidence: 0.9 },
        rechtsform: { wert: 'GmbH', quelle: 'Datei', confidence: 0.9 },
        groessenklasse: { wert: 'mittelgrosse Kapitalgesellschaft', quelle: 'Datei', confidence: 0.8 },
        organe: [],
      },
    });

    const result = normalizeMissingDisclosureRequirements(analysis);
    const lagebericht = result.fehlende_angaben.find(item => item.bereich === 'Lagebericht');

    expect(lagebericht?.prioritaet).toBe('zwingend');
    expect(lagebericht?.warum_erforderlich).toContain('mittelgrossen');
  });

  it('stuft fehlenden Lagebericht bei unbekannter Groessenklasse als empfohlen zu pruefen ein', () => {
    const analysis = buildAnalysis({
      gesellschaft: {
        name: { wert: 'Orbis gGmbH i.L.', quelle: 'Datei', confidence: 0.9 },
        rechtsform: { wert: 'gGmbH i.L.', quelle: 'Datei', confidence: 0.9 },
        organe: [],
      },
    });

    const result = normalizeMissingDisclosureRequirements(analysis);
    const lagebericht = result.fehlende_angaben.find(item => item.bereich === 'Lagebericht');

    expect(lagebericht?.prioritaet).toBe('empfohlen');
    expect(`${lagebericht?.fehlende_angabe} ${lagebericht?.warum_erforderlich}`).toContain('zu pruefen');
  });
});
