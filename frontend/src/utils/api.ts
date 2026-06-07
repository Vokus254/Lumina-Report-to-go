const viteEnv = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env;
const DEFAULT_PROD_API_BASE_URL = 'https://lumina-report-to-go-production.up.railway.app';

const rawApiBaseUrl =
  viteEnv?.VITE_API_BASE_URL ||
  viteEnv?.API_BASE_URL ||
  (viteEnv?.DEV === true ? '' : DEFAULT_PROD_API_BASE_URL);

export const API_BASE_URL = String(rawApiBaseUrl || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const PILOT_CODE_STORAGE_KEY = 'luminaPilotAccessCode';
export const PILOT_ACCESS_INVALID_EVENT = 'luminaPilotAccessInvalid';

function getPilotAccessCode(): string {
  return window.localStorage.getItem(PILOT_CODE_STORAGE_KEY) || '';
}

function friendlyApiError(status: number, message: string): string {
  if (status === 0) return 'Backend nicht erreichbar. Bitte pruefen Sie die Verbindung und versuchen Sie es erneut.';
  if (status === 401) return 'Zugriffscode ungueltig oder fehlt. Bitte geben Sie den Pilot-Zugangscode erneut ein.';
  if (status === 429) return message || 'Rate Limit erreicht. Bitte warten Sie kurz und versuchen Sie es erneut.';
  if (status === 413) return message || 'Datei zu gross. Bitte laden Sie eine kleinere Excel-Datei hoch.';
  if (status === 400 || status === 422) return message || 'Die Eingabedaten konnten nicht verarbeitet werden.';
  if (status === 503) return message || 'KI-Dienst aktuell nicht erreichbar. Fallback-Texte werden verwendet, soweit moeglich.';
  return message || 'Die Anfrage konnte nicht verarbeitet werden.';
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const pilotCode = getPilotAccessCode();
  if (pilotCode) headers.set('X-Pilot-Access-Code', pilotCode);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch (err) {
    throw new Error(friendlyApiError(0, (err as Error).message));
  }

  if (response.status === 401) {
    window.localStorage.removeItem(PILOT_CODE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(PILOT_ACCESS_INVALID_EVENT));
  }

  return response;
}

export async function readApiError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return friendlyApiError(response.status, payload?.error || response.statusText);
}

export async function analyzeUploadedFiles(files: File[]): Promise<unknown> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  const response = await apiFetch('/api/analyze-uploaded-files', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json();
}
