# Lumina Report to Go

MVP zur Erstellung HGB-orientierter Jahresabschlussentwuerfe als DOCX/ZIP:
Lagebericht, Bilanz/GuV und Anhang. Die Freitexte werden im Normalbetrieb mit
OpenAI erzeugt; fuer lokale Exporttests kann ein Mock-Modus genutzt werden.

## Architektur

```text
nexus-app/
├── backend/            Express API mit TypeScript
├── frontend/           React Wizard mit Vite + TypeScript
└── packages/schema/    Gemeinsame Zod-Schemas und Typen
```

## Environment Variables

Backend:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
AI_PROVIDER=openai
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
PILOT_ACCESS_CODE=your_pilot_access_code_here
PORT=3001
USE_MOCK_AI_TEXTS=false
```

Frontend:

```env
VITE_API_BASE_URL=http://127.0.0.1:3001
```

Keine echten API-Keys in Git, Markdown, Logs oder Beispiel-Dateien speichern.

## Deployment: Vercel Frontend + Railway Backend

### Railway Backend

Railway-Projekt fuer das Backend:

- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

Environment Variables in Railway:

```env
OPENAI_API_KEY=...
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4.1-mini
USE_MOCK_AI_TEXTS=false
CORS_ORIGINS=https://lumina-report-to-go.vercel.app,http://127.0.0.1:5173,http://localhost:5173
```

Railway setzt `PORT` automatisch. Das Backend liest `process.env.PORT` und faellt lokal auf `3001` zurueck.

Nach dem Deployment testen:

```text
https://DEIN-RAILWAY-BACKEND.up.railway.app/health
```

Die Upload-Analyse liegt unter:

```text
POST https://DEIN-RAILWAY-BACKEND.up.railway.app/api/analyze-uploaded-files
```

### Vercel Frontend

Vercel-Projekt fuer das Frontend:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Environment Variable in Vercel:

```env
VITE_API_BASE_URL=https://DEIN-RAILWAY-BACKEND.up.railway.app
```

Nach Aenderung der Environment Variable muss das Vercel-Frontend neu deployed werden.

## Start Entwicklung

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Pilot-Zugangsschutz

Wenn `PILOT_ACCESS_CODE` im Backend gesetzt ist, muessen geschuetzte API-Aufrufe
den Header `X-Pilot-Access-Code` mitsenden. Das Frontend fragt den Code beim
ersten geschuetzten API-Aufruf ab und speichert ihn lokal im Browser.

`/health` bleibt ohne Zugangscode erreichbar.

## Mock-AI

Fuer lokalen DOCX-/ZIP-Export ohne externen OpenAI-API-Call:

```env
USE_MOCK_AI_TEXTS=true
```

Danach Backend neu starten. `/api/generate` verwendet dann deterministische
Mock- oder Fallback-Texte und erzeugt weiterhin die DOCX-Dateien im ZIP.

## Lumina Datenmuell-Upload testen

Die neue Upload-Diagnose laeuft serverseitig ueber `POST /api/analyze-uploaded-files`.
Der OpenAI-Key wird nur im Backend ueber `OPENAI_API_KEY` verwendet.

Lokaler Smoke-Test:

1. Backend mit gesetztem `OPENAI_API_KEY` und optional `PILOT_ACCESS_CODE` starten.
2. Frontend starten und den Pilot-Zugangscode eingeben.
3. Im Startbildschirm `Lumina Datenmuell-Upload` oeffnen.
4. Nacheinander testen:
   - Excel-Datei mit Bilanz/GuV hochladen.
   - PDF-Datei hochladen; bei Scan-PDFs muss ein OCR-Hinweis erscheinen.
   - Mehrere Dateien gleichzeitig hochladen.
   - ZIP-Datei mit mehreren Unterlagen hochladen.
   - Testfall mit fehlendem Anhang, fehlenden Organen oder fehlenden Vorjahreswerten hochladen.
5. Pruefen, ob Gesamtstatus, erkannte Dateien, Auffaelligkeiten, fehlende Angaben, naechste Schritte und Rueckfragen angezeigt werden.

## Tests

Backend:

```bash
cd backend
npm test
npm run type-check
npm run build
```

Frontend:

```bash
cd frontend
npm run type-check
npm run build
```
