import { describe, expect, it } from 'vitest';
import { normalizeAmountForAnalysis } from '../../services/luminaUploadAnalysisService';

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

  it('reduziert Sicherheit bei unklarer Einheit', () => {
    const result = normalizeAmountForAnalysis('362', 'Sonstige Rückstellungen 362');

    expect(result.erkannter_wert_eur).toBe(362);
    expect(result.einheit).toBe('UNKLAR');
    expect(result.confidencePenalty).toBe(true);
  });
});
