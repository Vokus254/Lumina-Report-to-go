import { describe, expect, it } from 'vitest';
import { normalizeAmountForAnalysis } from '../../services/luminaUploadAnalysisService';
import { LuminaFileAnalysisResultSchema } from '../../../packages/schema/src';

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
