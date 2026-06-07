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
