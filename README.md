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
VITE_API_BASE_URL=http://localhost:3001
```

Keine echten API-Keys in Git, Markdown, Logs oder Beispiel-Dateien speichern.

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
