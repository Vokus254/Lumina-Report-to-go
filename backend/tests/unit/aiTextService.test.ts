import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiTextsSchema } from '../../../packages/schema/src';

const originalFetch = globalThis.fetch;

function minimalData() {
  return {
    stammdaten: {
      firmenname: 'Test AG',
      sitz: 'Berlin',
      branche: 'Software',
      geschaeftsjahr: '2025',
    },
    segmente: [],
    guv: {},
    bilanz: {},
    kennzahlen: {},
    organe: { vorstand: [{ name: 'Max Mustermann', funktion: 'CEO' }], aufsichtsrat: [] },
    beteiligungen: [],
  } as any;
}

const validOpenAiTexts = {
  lagebericht: {
    geschaeftsmodell: 'Text',
    strategie: 'Text',
    gesamtwirtschaft: 'Text',
    geschaeftsverlauf: 'Text',
    ertragslage: 'Text',
    finanzlage: 'Text',
    vermoegenslage: 'Text',
    nachtragsbericht: 'Text',
    risiken: 'Text',
    chancen: 'Text',
    prognose: 'Text',
  },
  anhang: {
    rechtliche_grundlagen: 'Text',
    bilanzierungsgrundsaetze_intro: 'Text',
    bewertung_immaterielle: 'Text',
    bewertung_sachanlagen: 'Text',
    bewertung_vorraete: 'Text',
    bewertung_forderungen: 'Text',
    bewertung_rueckstellungen: 'Text',
    vorraete_kommentar: 'Text',
    forderungen_kommentar: 'Text',
    eigenkapital_kommentar: 'Text',
    rueckstellungen_kommentar: 'Text',
    verbindlichkeiten_kommentar: 'Text',
    umsatz_kommentar: 'Text',
    personal_kommentar: 'Text',
    derivate_kommentar: 'Text',
    nahestehende_kommentar: 'Text',
    ereignisse_nach_stichtag: 'Text',
    bestaetigung_pruefungsurteil: 'Text',
  },
};

describe('aiTextService OpenAI mode', () => {
  afterEach(() => {
    delete process.env['USE_MOCK_AI_TEXTS'];
    delete process.env['OPENAI_API_KEY'];
    delete process.env['OPENAI_MODEL'];
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('liefert Mock-Texte ohne externen OpenAI-Call', async () => {
    process.env['USE_MOCK_AI_TEXTS'] = 'true';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { generateTexts } = await import('../../services/aiTextService.ts');
    const texts = await generateTexts(minimalData());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(AiTextsSchema.safeParse(texts).success).toBe(true);
    expect(texts.lagebericht.geschaeftsmodell).toContain('Mock-Text');
  });

  it('liefert bei fehlendem OPENAI_API_KEY deterministische Fallback-Texte', async () => {
    const { generateTexts } = await import('../../services/aiTextService.ts');

    const texts = await generateTexts(minimalData());

    expect(AiTextsSchema.safeParse(texts).success).toBe(true);
    expect(texts.lagebericht.geschaeftsmodell).toContain('Fallback');
  });

  it('nutzt OpenAI Responses API und validiert das Schema', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    process.env['OPENAI_MODEL'] = 'test-model';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(validOpenAiTexts) }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { generateTexts } = await import('../../services/aiTextService.ts');
    const texts = await generateTexts(minimalData());

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('test-model');
    expect(AiTextsSchema.safeParse(texts).success).toBe(true);
  });
});
