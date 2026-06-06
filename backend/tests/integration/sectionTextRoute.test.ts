import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'http';

const generateSectionTextMock = vi.fn();

vi.mock('../../services/openAiSectionTextService', () => ({
  generateSectionText: generateSectionTextMock,
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { app } = await import('../../server.ts');
  server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('POST /api/ai/section-text', () => {
  it('antwortet mit 422 bei ungueltigem Body', async () => {
    const response = await fetch(`${baseUrl}/api/ai/section-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: 'anhang_b4_eigenkapital' }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toHaveProperty('error');
  });

  it('antwortet mit 200 und validem SectionTextOutput', async () => {
    generateSectionTextMock.mockResolvedValueOnce({
      sectionId: 'anhang_b4_eigenkapital',
      status: 'draft',
      text: 'Das Eigenkapital wird erlaeutert.',
      warnings: [],
      missingInputs: ['Beschluss fehlt'],
      usedFacts: ['eigenkapital: 39761'],
    });

    const response = await fetch(`${baseUrl}/api/ai/section-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: 'anhang_b4_eigenkapital',
        title: 'Eigenkapital',
        facts: { eigenkapital: 39761 },
        requirements: ['Beschluss fehlt'],
        style: 'knapp',
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sectionId: 'anhang_b4_eigenkapital',
      status: 'draft',
      text: 'Das Eigenkapital wird erlaeutert.',
      warnings: [],
      missingInputs: ['Beschluss fehlt'],
      usedFacts: ['eigenkapital: 39761'],
    });
    expect(generateSectionTextMock).toHaveBeenCalledWith({
      sectionId: 'anhang_b4_eigenkapital',
      title: 'Eigenkapital',
      facts: ['eigenkapital: 39761'],
      missingInputs: ['Beschluss fehlt'],
      style: 'knapp',
    });
  });
});
