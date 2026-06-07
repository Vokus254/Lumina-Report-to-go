import { describe, expect, it } from 'vitest';
import { detectContentType } from '../../services/luminaFileExtractionService';

describe('detectContentType', () => {
  it('priorisiert Anhang vor Bilanz, wenn Bilanz und GuV nur im Anhang erwähnt werden', () => {
    const result = detectContentType(
      '2026-03-18 Anhang_TFSS 2025 - Entwurf v.1 an BPG.docx',
      [
        'Anhang zum Jahresabschluss für das Geschäftsjahr 2025',
        'Bilanzierungs- und Bewertungsmethoden',
        'Die Bilanz und die Gewinn- und Verlustrechnung wurden nach HGB aufgestellt.',
        'Angaben nach § 284 und § 285 HGB.',
      ].join('\n'),
    );

    expect(result).toBe('anhang');
  });
});
