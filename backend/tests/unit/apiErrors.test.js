/**
 * Test: API-Fehlerklassifizierung
 * Simuliert overloaded_error und auth-Fehler ohne echten API-Aufruf.
 */
import { describe, it, expect } from 'vitest';

// Nachbau der Erkennungslogik aus server.ts
function classifyApiError(err) {
  if (err?.status === 529 || err?.error?.type === 'overloaded_error') return 'overloaded';
  if (err?.status === 401 || err?.status === 403) return 'auth';
  return 'generic';
}

describe('API Fehlerklassifizierung', () => {
  it('erkennt overloaded via status 529', () => {
    expect(classifyApiError({ status: 529 })).toBe('overloaded');
  });

  it('erkennt overloaded via error.type', () => {
    expect(classifyApiError({ status: 529, error: { type: 'overloaded_error', message: 'Overloaded' } })).toBe('overloaded');
  });

  it('erkennt overloaded via error.type ohne status', () => {
    expect(classifyApiError({ error: { type: 'overloaded_error' } })).toBe('overloaded');
  });

  it('erkennt auth-Fehler 401', () => {
    expect(classifyApiError({ status: 401 })).toBe('auth');
  });

  it('erkennt auth-Fehler 403', () => {
    expect(classifyApiError({ status: 403 })).toBe('auth');
  });

  it('klassifiziert sonstige Fehler als generic', () => {
    expect(classifyApiError({ status: 500, message: 'Internal Error' })).toBe('generic');
    expect(classifyApiError(new Error('Network error'))).toBe('generic');
  });

  it('überlebt null/undefined', () => {
    expect(classifyApiError(null)).toBe('generic');
    expect(classifyApiError(undefined)).toBe('generic');
  });
});
