import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiTextsSchema } from '@nexus/schema';

const createMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function AnthropicMock() {
    return {
      messages: {
        create: createMock,
      },
    };
  }),
}));

describe('aiTextService mock mode', () => {
  afterEach(() => {
    delete process.env['USE_MOCK_AI_TEXTS'];
    createMock.mockReset();
    vi.resetModules();
  });

  it('liefert Mock-Texte ohne Anthropic API-Call', async () => {
    process.env['USE_MOCK_AI_TEXTS'] = 'true';
    createMock.mockRejectedValue(new Error('external call must not happen'));

    const { generateTexts } = await import('../../services/aiTextService.ts');
    const texts = await generateTexts({
      stammdaten: {
        firmenname: 'Test AG',
        sitz: 'Berlin',
        geschaeftsjahr: '2025',
      },
      segmente: [],
      guv: {},
      bilanz: {},
      kennzahlen: {},
      organe: { vorstand: [{ name: 'Max Mustermann', funktion: 'CEO' }], aufsichtsrat: [] },
      beteiligungen: [],
    } as any);

    expect(createMock).not.toHaveBeenCalled();
    expect(AiTextsSchema.safeParse(texts).success).toBe(true);
    expect(texts.lagebericht.geschaeftsmodell).toContain('Mock-Text');
  });
});
