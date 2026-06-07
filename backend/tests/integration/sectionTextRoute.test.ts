import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

afterEach(() => {
  delete process.env['PILOT_ACCESS_CODE'];
  delete process.env['CORS_ORIGINS'];
  generateSectionTextMock.mockReset();
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

  it('antwortet mit 401 ohne gueltigen Pilot-Zugangscode', async () => {
    process.env['PILOT_ACCESS_CODE'] = 'pilot-test';

    const response = await fetch(`${baseUrl}/api/ai/section-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: 'anhang.vorraete',
        title: 'Vorräte',
        facts: {},
        requirements: [],
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(expect.objectContaining({
      code: 'PILOT_ACCESS_REQUIRED',
    }));
  });

  it('akzeptiert API-Aufrufe mit gueltigem Pilot-Zugangscode', async () => {
    process.env['PILOT_ACCESS_CODE'] = 'pilot-test';
    generateSectionTextMock.mockResolvedValueOnce({
      sectionId: 'anhang.vorraete',
      status: 'draft',
      text: 'Text wurde erzeugt.',
      paragraphs: [],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: [],
    });

    const response = await fetch(`${baseUrl}/api/ai/section-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pilot-Access-Code': 'pilot-test',
      },
      body: JSON.stringify({
        sectionId: 'anhang.vorraete',
        title: 'Vorräte',
        facts: {},
        requirements: [],
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      text: 'Text wurde erzeugt.',
    }));
  });

  it('begrenzt /api/generate auf 10 Requests pro Stunde und IP', async () => {
    process.env['PILOT_ACCESS_CODE'] = 'pilot-test';
    const headers = {
      'Content-Type': 'application/json',
      'X-Pilot-Access-Code': 'pilot-test',
      'X-Forwarded-For': '203.0.113.77',
    };

    for (let i = 0; i < 10; i += 1) {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(422);
    }

    const limited = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual(expect.objectContaining({
      code: 'RATE_LIMIT_EXCEEDED',
    }));
  });

  it('liest CORS_ORIGINS und erlaubt den Vercel-Origin', async () => {
    process.env['CORS_ORIGINS'] = 'https://lumina-report-to-go.vercel.app';

    const response = await fetch(`${baseUrl}/api/ai/section-text`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://lumina-report-to-go.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,X-Pilot-Access-Code',
      },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('https://lumina-report-to-go.vercel.app');
    expect(response.headers.get('access-control-allow-headers')).toContain('X-Pilot-Access-Code');
  });

  it('lehnt nicht konfigurierte CORS-Origins ab', async () => {
    process.env['CORS_ORIGINS'] = 'https://lumina-report-to-go.vercel.app';

    const response = await fetch(`${baseUrl}/api/ai/section-text`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.invalid',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
