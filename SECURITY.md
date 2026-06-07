# Security Policy

## Secrets & API-Keys

- `OPENAI_API_KEY` wird ausschliesslich serverseitig im Backend gesetzt.
- `backend/.env` ist nicht versioniert und darf nicht committed werden.
- `backend/.env.example` enthaelt nur Platzhalter, keine echten Keys.
- API-Keys duerfen nicht im Frontend, in Markdown-Dateien, Logs oder ZIP-Dateien gespeichert werden.

## Pilot-Zugangscode

- Fuer den Pilotbetrieb kann `PILOT_ACCESS_CODE` gesetzt werden.
- Geschuetzte API-Endpunkte erwarten dann den Header `X-Pilot-Access-Code`.
- `/health` bleibt bewusst frei erreichbar, damit Hosting-Plattformen den Dienst pruefen koennen.

## CORS

- Erlaubte Origins werden ueber `CORS_ORIGINS` als kommaseparierte Liste gesteuert.
- Lokale Fallbacks sind `http://localhost:5173` und `http://localhost:3000`.
- Erlaubte Header: `Content-Type`, `Authorization`, `X-Pilot-Access-Code`.

## Rate-Limiting

- `/api/generate`: 10 Requests pro Stunde und IP.
- `/api/import` und `/api/import-excel`: 30 Requests pro Stunde und IP.
- Bei Ueberschreitung antwortet die API mit HTTP 429.

## Excel-Uploads

Eingabe-Dateien werden nicht persistent gespeichert. Die Backend-Import-Route
arbeitet in-memory und begrenzt Uploads auf 10 MB. Fuer den produktiven
Frontend-Import wird die Excel-Datei browserseitig gelesen.

## Checkliste vor jedem Commit

- [ ] Keine echten OpenAI-Keys in staged files.
- [ ] `.env` nicht staged.
- [ ] Keine Secrets in Markdown-, Log- oder ZIP-Dateien.
- [ ] Pilot-Zugangscode nur als Environment Variable setzen.
