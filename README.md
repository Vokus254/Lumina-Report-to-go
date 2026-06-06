# Jahresabschluss Generator

MVP zur Erstellung HGB-orientierter Jahresabschlussdokumente als DOCX/ZIP:
Lagebericht, Bilanz/GuV und Anhang. Die Freitexte werden im Normalbetrieb per
Claude API erzeugt; fuer lokale Exporttests kann ein Mock-Modus genutzt werden.

## Architektur

```text
nexus-app/
├── backend/            Express API mit TypeScript
│   ├── server.ts
│   ├── services/
│   ├── renderers/
│   └── utils/
├── frontend/           React Wizard mit Vite + TypeScript
│   └── src/
└── packages/schema/    Gemeinsame Zod-Schemas und Typen
```

## Setup

Voraussetzungen:
- Node.js >= 18
- Anthropic API-Key fuer echten KI-Betrieb

Backend konfigurieren:

```bash
cd backend
npm install
cp .env.example .env
```

In `backend/.env`:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=3001
USE_MOCK_AI_TEXTS=false
```

## Start Entwicklung

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

App:

```text
http://localhost:3000
```

## Mock-AI

Fuer lokalen DOCX-/ZIP-Export ohne externen Claude-API-Call:

```env
USE_MOCK_AI_TEXTS=true
```

Danach Backend neu starten. `/api/generate` verwendet dann deterministische
Mock-Texte und erzeugt trotzdem die DOCX-Dateien im ZIP.

## Tests

Backend:

```bash
cd backend
npm test
npm run type-check
```

Schema-Paket:

```bash
cd packages/schema
npm run build
npm test
```
