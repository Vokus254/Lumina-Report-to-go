# Security Policy

## Secrets & API-Keys

- **Anthropic API-Key** wird in `backend/.env` gespeichert (nicht versioniert).
- `backend/.env` ist in `.gitignore` eingetragen — **niemals diese Datei committen**.
- Template: `backend/.env.example` (ohne echten Key).

### Key-Rotation

Der im Entwicklungskontext verwendete API-Key gilt als kompromittiert
(war in Session-Transcripts sichtbar). Bitte unter
https://console.anthropic.com einen neuen Key generieren und den alten invalidieren.

### Checkliste vor jedem Commit

- [ ] Kein `sk-ant-` in staged files (`git diff --cached | grep sk-ant`)
- [ ] `.env` nicht staged
- [ ] Keine Secrets in Markdown-, Log- oder ZIP-Dateien

## Excel-Uploads

Eingabe-Dateien werden nicht persistent gespeichert (in-memory multer).
Dateigröße ist auf 10 MB begrenzt. Nur `.xlsx` sollte akzeptiert werden.
