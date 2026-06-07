import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { analyzeUploadedFiles } from '../utils/api';

type NormalizedFileContent = {
  fileName: string;
  fileType: string;
  detectedContentType: string;
  textContent: string;
  extractionWarnings: string[];
  confidence: number;
  [key: string]: unknown;
};

type MissingInformation = {
  prioritaet: string;
  bereich: string;
  fehlende_angabe: string;
  warum_erforderlich: string;
  beispiel_nachfrage_an_nutzer: string;
};

type NextStep = {
  schritt?: number;
  massnahme?: string;
  ziel?: string;
  titel?: string;
};

type LuminaFileAnalysisResult = {
  analyse_status: {
    gesamtbeurteilung: string;
    datenqualitaet: string;
    abschlussfaehigkeit: string;
    kurzbegruendung: string;
  };
  dateien: unknown[];
  gesellschaft: unknown;
  erkannte_abschlussbestandteile: Record<string, unknown>;
  bilanz: unknown;
  guv: unknown;
  mapping_vorschlag: unknown[];
  auffaelligkeiten: unknown[];
  fehlende_angaben: MissingInformation[];
  naechste_schritte: NextStep[];
  fragen_an_nutzer: unknown[];
};

type UploadAnalysisResponse = {
  normalizedFiles: NormalizedFileContent[];
  extractionWarnings: string[];
  analysis: LuminaFileAnalysisResult;
  model: string;
  timestamp: string;
  rawAnalysisResult?: unknown;
};

function asResponse(value: unknown): UploadAnalysisResponse {
  return value as UploadAnalysisResponse;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = 'nicht erkannt'): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return fallback;
  return String(value);
}

function readableText(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return fallback;
    }
    return trimmed || fallback;
  }
  return text(value, fallback);
}

function valueText(value: unknown, fallback = 'nicht erkannt'): string {
  const record = asRecord(value);
  return text(record.wert ?? value, fallback);
}

function sourceText(value: unknown): string {
  return text(asRecord(value).quelle, '-');
}

function formatPercent(confidence: unknown): string {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return '-';
  return `${Math.round(confidence * 100)} %`;
}

function confidenceText(value: unknown): string {
  return formatPercent(asRecord(value).confidence);
}

function statusColor(value: string | undefined): CSSProperties {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('ja') || normalized.includes('hoch') || normalized.includes('plausibel')) return { background: '#eaf7ef', color: '#16794c' };
  if (normalized.includes('nein') || normalized.includes('niedrig') || normalized.includes('kritisch') || normalized.includes('zwingend')) return { background: '#fff0ee', color: '#b42318' };
  return { background: '#fff4df', color: '#a15c07' };
}

function formatBadge(value: string | undefined): CSSProperties {
  return statusColor(value);
}

function priorityStyle(value: string): CSSProperties {
  const normalized = value.toLowerCase();
  if (normalized.includes('hoch') || normalized.includes('zwingend')) return { background: '#fff0ee', color: '#b42318' };
  if (normalized.includes('mittel') || normalized.includes('empfohlen')) return { background: '#fff4df', color: '#a15c07' };
  return { background: '#f2f4f7', color: '#344054' };
}

function trafficLabel(value: string | undefined): string {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'ja') return '🟢 Abschlussfähigkeit: ja';
  if (normalized === 'nein') return '🔴 Abschlussfähigkeit: nein';
  return '🟡 Abschlussfähigkeit: teilweise';
}

function trafficBorder(value: string | undefined): string {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'ja') return '#16794c';
  if (normalized === 'nein') return '#b42318';
  return '#f59e0b';
}

function statusSymbol(value: unknown): string {
  if (value === true) return '✅';
  if (value === false || value === null || value === undefined) return '❌';
  const normalized = String(value).toLowerCase();
  if (normalized.includes('vorhanden') || normalized.includes('ja') || normalized.includes('true')) return '✅';
  if (normalized.includes('fehlt') || normalized.includes('nein') || normalized.includes('false')) return '❌';
  return '⚠️';
}

function statusLabel(value: unknown): string {
  if (value === true) return 'vorhanden';
  if (value === false || value === null || value === undefined) return 'fehlt';
  return String(value);
}

function renderBooleanStatus(value: unknown): ReactNode {
  return (
    <>
      <span>{statusSymbol(value)}</span>
      <strong>{statusLabel(value)}</strong>
    </>
  );
}

function formatCurrency(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} EUR`;
  }
  const stringValue = String(value);
  const numeric = Number(stringValue.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  if (Number.isFinite(numeric) && /\d/.test(stringValue) && !/[A-Za-z]/.test(stringValue.replace(/EUR|TEUR/gi, ''))) {
    return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric)} EUR`;
  }
  return stringValue;
}

function mappingAmountText(mapping: Record<string, unknown>): string {
  if (mapping.hinweis) return 'nicht eindeutig';
  return formatCurrency(mapping.erkannter_wert_eur);
}

function plausibilityText(value: unknown): string {
  if (value === null || value === undefined) return 'nicht beurteilbar';
  if (value === true) return 'plausibel';
  if (value === false) return 'nicht plausibel';
  return text(value, 'nicht beurteilbar');
}

function isSchemaProcessingError(error: Error): boolean {
  return /KI-Antwort entspricht nicht dem erwarteten JSON-Schema|invalid_type|expected.*boolean|Zod/i.test(error.message);
}

function DetailSection({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  return (
    <details style={S.details} open={initiallyOpen}>
      <summary style={S.summary}>{title}</summary>
      <div style={S.detailBody}>{children}</div>
    </details>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  if (!rows.length) return <div style={S.emptyHint}>Keine Daten erkannt.</div>;
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead>
          <tr>{columns.map(column => <th key={column} style={S.th}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex} style={S.td}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PriorityPill({ value }: { value: string }) {
  return <span style={{ ...S.priority, ...priorityStyle(value) }}>{value || '-'}</span>;
}

function renderPriorityBadge(priority: unknown): ReactNode {
  return <PriorityPill value={text(priority, 'mittel')} />;
}

export default function LuminaUploadAnalysis() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [technicalError, setTechnicalError] = useState('');
  const [result, setResult] = useState<UploadAnalysisResponse | null>(null);

  const requiredMissing = useMemo(
    () => result?.analysis.fehlende_angaben?.filter(item => item.prioritaet === 'zwingend') ?? [],
    [result],
  );
  const nextStep = result?.analysis.naechste_schritte?.[0];
  const gesellschaft = asRecord(result?.analysis.gesellschaft);
  const organe = asArray(gesellschaft.organe);

  const runAnalysis = async () => {
    if (!files.length) {
      setMessage('Bitte laden Sie mindestens eine Datei hoch.');
      return;
    }
    setStatus('loading');
    setMessage('Lumina liest die Dateien und erstellt die HGB-Diagnose...');
    setTechnicalError('');
    setResult(null);
    try {
      const response = asResponse(await analyzeUploadedFiles(files));
      setResult(response);
      setStatus('done');
      setMessage('Analyse abgeschlossen.');
    } catch (err) {
      const error = err as Error;
      setStatus('error');
      setTechnicalError(error.message);
      setMessage(isSchemaProcessingError(error)
        ? 'Die KI-Antwort konnte nicht vollständig verarbeitet werden. Bitte versuchen Sie es erneut oder laden Sie die Datei in einem strukturierteren Format hoch.'
        : error.message);
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.hero}>
        <div style={S.kicker}>Datenmüll-Upload mit KI-Diagnose</div>
        <h1 style={S.title}>Lade einfach deine vorhandenen Abschlussunterlagen hoch.</h1>
        <p style={S.lead}>
          Lumina erkennt, was vorliegt, ordnet es fachlich ein und sagt dir, was für einen prüfungsnahen Jahresabschluss noch fehlt.
        </p>
      </div>

      <div style={S.panel}>
        <label style={S.upload}>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.zip,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff"
            style={{ display: 'none' }}
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
          />
          <strong>Dateien auswählen</strong>
          <span>PDF, Word, Excel, CSV, TXT, ZIP und Bilder/Screenshots</span>
        </label>
        {files.length > 0 && (
          <div style={S.fileList}>
            {files.map(file => (
              <div key={`${file.name}-${file.size}`} style={S.fileRow}>
                <span>{file.name}</span>
                <span style={S.muted}>{Math.round(file.size / 1024)} KB</span>
              </div>
            ))}
          </div>
        )}
        <button type="button" style={S.primaryBtn} onClick={() => void runAnalysis()} disabled={status === 'loading'}>
          {status === 'loading' ? 'Analyse läuft...' : 'Dateien analysieren'}
        </button>
        {message && <div style={{ ...S.message, ...(status === 'error' ? S.error : {}) }}>{message}</div>}
      </div>

      {result && (
        <div style={S.results}>
          <div style={{ ...S.instant, borderLeft: `6px solid ${trafficBorder(result.analysis.analyse_status.abschlussfaehigkeit)}` }}>
            <div style={S.instantMain}>
              <div style={S.kicker}>Management Summary</div>
              <h2 style={S.resultTitle}>{trafficLabel(result.analysis.analyse_status.abschlussfaehigkeit)}</h2>
              <p style={S.leadSmall}>{readableText(result.analysis.analyse_status.kurzbegruendung, 'Lumina hat eine erste Abschlussdiagnose erstellt.')}</p>
            </div>
            <div style={{ ...S.summaryNotice, ...statusColor(result.analysis.analyse_status.abschlussfaehigkeit) }}>
              {readableText(result.analysis.analyse_status.gesamtbeurteilung, 'Diagnose erstellt')}
            </div>
          </div>

          <div style={S.cards}>
            <div style={S.card}>
              <div style={S.cardLabel}>Datenqualität</div>
              <strong>{result.analysis.analyse_status.datenqualitaet}</strong>
            </div>
            <div style={S.card}>
              <div style={S.cardLabel}>Zwingend fehlende Angaben</div>
              <strong>{requiredMissing.length}</strong>
            </div>
            <div style={S.card}>
              <div style={S.cardLabel}>Nächster Schritt</div>
              <strong>{nextStep?.massnahme || nextStep?.titel || 'Ergebnis prüfen'}</strong>
            </div>
          </div>

          <DetailSection title="Gesamtbeurteilung" initiallyOpen>
            <div style={S.summaryTextBlock}>
              <p style={S.readableText}>{readableText(result.analysis.analyse_status.gesamtbeurteilung, 'Lumina hat eine fachliche Erstdiagnose erstellt.')}</p>
              <p style={S.readableText}>{readableText(result.analysis.analyse_status.kurzbegruendung, 'Die hochgeladenen Unterlagen wurden fachlich eingeordnet.')}</p>
              <div style={S.badgeRow}>
                <span style={{ ...S.badge, ...formatBadge(result.analysis.analyse_status.abschlussfaehigkeit) }}>
                  Abschlussfähigkeit: {result.analysis.analyse_status.abschlussfaehigkeit || 'unklar'}
                </span>
                <span style={{ ...S.badge, ...formatBadge(result.analysis.analyse_status.datenqualitaet) }}>
                  Datenqualität: {result.analysis.analyse_status.datenqualitaet || 'unklar'}
                </span>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Erkannte Dateien" initiallyOpen>
            <DataTable
              columns={['Datei', 'Dateityp', 'Erkannter Inhalt', 'Relevanz', 'Datenqualität', 'Bemerkung']}
              rows={result.analysis.dateien.map(item => {
                const file = asRecord(item);
                return [
                  text(file.dateiname, '-'),
                  text(file.erkannter_dateityp ?? file.dateityp ?? file.detectedContentType, '-'),
                  text(file.erkannter_inhalt, '-'),
                  <span style={{ ...S.priority, ...formatBadge(text(file.relevanz, '')) }}>{text(file.relevanz, '-')}</span>,
                  <span style={{ ...S.priority, ...formatBadge(text(file.datenqualitaet, '')) }}>{text(file.datenqualitaet, '-')}</span>,
                  text(file.bemerkungen, '-'),
                ];
              })}
            />
          </DetailSection>

          <DetailSection title="Erkannte Gesellschaftsdaten">
            <DataTable
              columns={['Feld', 'Erkannter Wert', 'Quelle', 'Sicherheit']}
              rows={[
                ['Name', valueText(gesellschaft.name), sourceText(gesellschaft.name), confidenceText(gesellschaft.name)],
                ['Rechtsform', valueText(gesellschaft.rechtsform), sourceText(gesellschaft.rechtsform), confidenceText(gesellschaft.rechtsform)],
                ['Sitz', valueText(gesellschaft.sitz), sourceText(gesellschaft.sitz), confidenceText(gesellschaft.sitz)],
                ['Geschäftsjahr', valueText(gesellschaft.geschaeftsjahr), sourceText(gesellschaft.geschaeftsjahr), confidenceText(gesellschaft.geschaeftsjahr)],
                ['Bilanzstichtag', valueText(gesellschaft.bilanzstichtag), sourceText(gesellschaft.bilanzstichtag), confidenceText(gesellschaft.bilanzstichtag)],
              ]}
            />
            {organe.length > 0 && (
              <div style={S.subBlock}>
                <h3 style={S.groupTitle}>Organe</h3>
                <DataTable
                  columns={['Name', 'Funktion', 'Ort', 'Quelle', 'Sicherheit']}
                  rows={organe.map(organ => {
                    const record = asRecord(organ);
                    return [
                      text(record.name ?? record.wert ?? organ, '-'),
                      text(record.funktion ?? record.rolle, '-'),
                      text(record.ort, '-'),
                      text(record.quelle, '-'),
                      confidenceText(record),
                    ];
                  })}
                />
              </div>
            )}
          </DetailSection>

          <DetailSection title="Erkannte Abschlussbestandteile">
            <div style={S.checkGrid}>
              {[
                ['bilanz', 'Bilanz'],
                ['guv', 'GuV'],
                ['anhang', 'Anhang'],
                ['lagebericht', 'Lagebericht'],
                ['susa', 'SuSa'],
                ['kontennachweis', 'Kontennachweis'],
                ['anlagenverzeichnis', 'Anlagenverzeichnis'],
                ['op_listen', 'OP-Listen'],
                ['vertraege', 'Verträge'],
              ].map(([key, label]) => {
                const value = result.analysis.erkannte_abschlussbestandteile[key];
                return (
                  <div key={key} style={S.checkItem}>
                    {renderBooleanStatus(value)}
                    <strong>{label}</strong>
                  </div>
                );
              })}
            </div>
          </DetailSection>

          <DetailSection title="Bilanz / GuV / Mapping-Vorschlag">
            <div style={S.noticeStack}>
              {asArray(asRecord(result.analysis.bilanz).aktiva).length === 0 && asArray(asRecord(result.analysis.bilanz).passiva).length === 0 && (
                <div style={S.emptyHint}>Es wurden noch keine vollständigen Bilanzdaten erkannt.</div>
              )}
              {asArray(asRecord(result.analysis.guv).positionen).length === 0 && (
                <div style={S.emptyHint}>Es wurden noch keine vollständigen GuV-Daten erkannt.</div>
              )}
              <div style={S.emptyHint}>Bilanz-Plausibilität: {plausibilityText(asRecord(result.analysis.bilanz).plausibel)}</div>
              <div style={S.emptyHint}>GuV-Plausibilität: {plausibilityText(asRecord(result.analysis.guv).plausibel)}</div>
              {asRecord(result.analysis.guv).jahresergebnis !== undefined && (
                <div style={S.emptyHint}>Erkanntes Jahresergebnis: {formatCurrency(asRecord(result.analysis.guv).jahresergebnis)}</div>
              )}
            </div>
            {result.analysis.mapping_vorschlag.length === 0 ? (
              <div style={S.emptyHint}>Noch keine Mapping-Vorschläge vorhanden.</div>
            ) : (
              <DataTable
                columns={['Quelle', 'Originalwert', 'Einheit', 'Wert in EUR', 'Vorjahr', 'HGB-Position', 'Begründung', 'Sicherheit', 'Hinweis']}
                rows={result.analysis.mapping_vorschlag.map(item => {
                  const mapping = asRecord(item);
                  return [
                    text(mapping.quelle_bezeichnung, '-'),
                    text(mapping.original_wert, '-'),
                    text(mapping.einheit, '-'),
                    mappingAmountText(mapping),
                    formatCurrency(mapping.vorjahr),
                    text(mapping.vorgeschlagene_hgb_position, '-'),
                    text(mapping.begruendung, '-'),
                    formatPercent(mapping.confidence),
                    text(mapping.hinweis, '-'),
                  ];
                })}
              />
            )}
          </DetailSection>

          <DetailSection title="Auffälligkeiten">
            {result.analysis.auffaelligkeiten.length === 0 ? <div style={S.emptyHint}>Keine Auffälligkeiten erkannt.</div> : (
              <div style={S.taskList}>
                {result.analysis.auffaelligkeiten.map((item, index) => {
                  const finding = asRecord(item);
                  return (
                    <div key={index} style={S.task}>
                      <div style={S.taskTop}>
                        {renderPriorityBadge(finding.prioritaet)}
                        <strong>{text(finding.bereich, 'Allgemein')}</strong>
                      </div>
                      <div style={S.taskTitle}>{text(finding.beschreibung, '-')}</div>
                      <div style={S.taskMeta}>Auswirkung: {text(finding.auswirkung, '-')}</div>
                      <div style={S.taskMeta}>Empfehlung: {text(finding.empfehlung, '-')}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Fehlende Angaben" initiallyOpen>
            {(['zwingend', 'empfohlen', 'optional'] as const).map(group => {
              const items = result.analysis.fehlende_angaben.filter(item => item.prioritaet === group);
              if (!items.length) return null;
              return (
                <div key={group} style={S.groupBlock}>
                  <h3 style={S.groupTitle}>{group === 'zwingend' ? 'Zwingend erforderlich' : group === 'empfohlen' ? 'Empfohlen' : 'Optional'}</h3>
                  <div style={S.taskList}>
                    {items.map((item, index) => (
                      <div key={`${group}-${index}`} style={{ ...S.task, ...(group === 'zwingend' ? S.taskCritical : {}) }}>
                        <div style={S.taskTop}>
                          {renderPriorityBadge(item.prioritaet)}
                          <strong>{item.bereich || 'Allgemein'}</strong>
                        </div>
                        <div style={S.taskTitle}>{item.fehlende_angabe}</div>
                        <div style={S.taskMeta}>Warum erforderlich: {item.warum_erforderlich}</div>
                        <div style={S.taskMeta}>Beispiel-Nachfrage: {item.beispiel_nachfrage_an_nutzer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {result.analysis.fehlende_angaben.length === 0 && <div style={S.emptyHint}>Keine fehlenden Angaben gemeldet.</div>}
            {result.analysis.fehlende_angaben.length > 0 && (
              <button type="button" style={S.secondaryBtn} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Weitere Unterlagen hochladen
              </button>
            )}
          </DetailSection>

          <DetailSection title="Nächste Schritte" initiallyOpen>
            {result.analysis.naechste_schritte.length === 0 ? <div style={S.emptyHint}>Keine nächsten Schritte vorhanden.</div> : (
              <ol style={S.pathList}>
                {result.analysis.naechste_schritte.map((step, index) => (
                  <li key={index} style={S.pathItem}>
                    <strong>{step.massnahme || step.titel || `Schritt ${index + 1}`}</strong>
                    <div style={S.taskMeta}>{step.ziel || 'Ziel noch nicht benannt.'}</div>
                  </li>
                ))}
              </ol>
            )}
          </DetailSection>

          <DetailSection title="Rückfragen an den Nutzer">
            {result.analysis.fragen_an_nutzer.length === 0 ? <div style={S.emptyHint}>Keine Rückfragen vorhanden.</div> : (
              <DataTable
                columns={['Priorität', 'Frage', 'Zweck']}
                rows={result.analysis.fragen_an_nutzer.map(item => {
                  const question = asRecord(item);
                  return [
                    renderPriorityBadge(question.prioritaet),
                    text(question.frage, '-'),
                    text(question.zweck, '-'),
                  ];
                })}
              />
            )}
          </DetailSection>

          <DetailSection title="Entwicklerdetails anzeigen">
            <pre style={S.json}>{JSON.stringify({
              model: result.model,
              timestamp: result.timestamp,
              extractionWarnings: result.extractionWarnings,
              normalizedFiles: result.normalizedFiles,
              rawAnalysisResult: result.rawAnalysisResult ?? result.analysis,
              technicalError: technicalError || undefined,
            }, null, 2)}</pre>
          </DetailSection>
        </div>
      )}
      {!result && technicalError && (
        <div style={S.results}>
          <DetailSection title="Entwicklerdetails anzeigen">
            <pre style={S.json}>{JSON.stringify({ technicalError }, null, 2)}</pre>
          </DetailSection>
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { maxWidth: 1040, margin: '0 auto', padding: '34px 28px 90px', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' },
  hero: { marginBottom: 18 },
  kicker: { fontSize: 12, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, overflowWrap: 'anywhere' },
  title: { margin: '6px 0 10px', fontSize: 32, lineHeight: 1.12, letterSpacing: '-0.035em', overflowWrap: 'anywhere' },
  lead: { margin: 0, color: '#667085', lineHeight: 1.55, maxWidth: 720, overflowWrap: 'anywhere' },
  leadSmall: { margin: '8px 0 0', color: '#667085', lineHeight: 1.5, overflowWrap: 'anywhere', wordBreak: 'break-word' },
  panel: { background: '#fff', border: '1px solid #e6e7e9', borderRadius: 16, padding: 18, marginBottom: 18, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' },
  upload: { display: 'grid', gap: 5, placeItems: 'center', minHeight: 150, border: '1.5px dashed #d0d5dd', borderRadius: 14, background: '#fbfbfa', cursor: 'pointer', color: '#344054' },
  fileList: { marginTop: 12, display: 'grid', gap: 6 },
  fileRow: { display: 'flex', justifyContent: 'space-between', gap: 12, background: '#fbfbfa', border: '1px solid #e6e7e9', borderRadius: 10, padding: '9px 11px', fontSize: 13, minWidth: 0, overflowWrap: 'anywhere' },
  muted: { color: '#667085', fontSize: 12 },
  primaryBtn: { marginTop: 14, border: '1px solid #111827', background: '#111827', color: '#fff', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' },
  secondaryBtn: { marginTop: 12, border: '1px solid #d0d5dd', background: '#fff', color: '#344054', borderRadius: 10, padding: '9px 13px', cursor: 'pointer', fontWeight: 650, fontFamily: 'inherit' },
  message: { marginTop: 12, padding: '10px 12px', background: '#eff6ff', color: '#175cd3', borderRadius: 10, fontSize: 13, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: '100%', boxSizing: 'border-box' },
  error: { background: '#fff0ee', color: '#b42318' },
  results: { display: 'grid', gap: 10, minWidth: 0, maxWidth: '100%' },
  instant: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12, alignItems: 'flex-start', background: '#fff', border: '1px solid #e6e7e9', borderRadius: 16, padding: 18, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' },
  instantMain: { minWidth: 0, maxWidth: '100%' },
  summaryNotice: { borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 650, lineHeight: 1.45, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%', boxSizing: 'border-box' },
  resultTitle: { margin: '5px 0 0', fontSize: 22, letterSpacing: '-0.02em', overflowWrap: 'anywhere' },
  badge: { borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, minWidth: 0 },
  card: { background: '#fff', border: '1px solid #e6e7e9', borderRadius: 14, padding: 14, minWidth: 0, overflowWrap: 'anywhere' },
  cardLabel: { color: '#667085', fontSize: 12, marginBottom: 5, overflowWrap: 'anywhere' },
  details: { background: '#fff', border: '1px solid #e6e7e9', borderRadius: 14, overflow: 'hidden', minWidth: 0, maxWidth: '100%' },
  summary: { padding: '12px 14px', cursor: 'pointer', fontWeight: 700, overflowWrap: 'anywhere' },
  detailBody: { borderTop: '1px solid #e6e7e9', padding: 14, minWidth: 0, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' },
  tableWrap: { width: '100%', maxWidth: '100%', overflowX: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' },
  th: { textAlign: 'left', padding: '9px 10px', borderBottom: '1px solid #e6e7e9', color: '#667085', fontSize: 12, fontWeight: 700, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', verticalAlign: 'top' },
  td: { padding: '10px', borderBottom: '1px solid #f2f4f7', verticalAlign: 'top', color: '#344054', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', minWidth: 0 },
  checkGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 },
  checkItem: { display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 8, border: '1px solid #e6e7e9', borderRadius: 10, padding: '10px 12px', background: '#fbfbfa' },
  priority: { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '3px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'normal', overflowWrap: 'anywhere', maxWidth: '100%' },
  taskList: { display: 'grid', gap: 10 },
  task: { border: '1px solid #e6e7e9', borderRadius: 12, padding: 12, background: '#fff', minWidth: 0, overflowWrap: 'anywhere' },
  taskCritical: { borderColor: '#f5c2bd', background: '#fffafa' },
  taskTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap', minWidth: 0 },
  taskTitle: { fontWeight: 700, color: '#17212f', marginBottom: 5, overflowWrap: 'anywhere', wordBreak: 'break-word' },
  taskMeta: { color: '#667085', fontSize: 13, lineHeight: 1.45, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' },
  groupBlock: { display: 'grid', gap: 8, marginBottom: 14 },
  groupTitle: { margin: 0, fontSize: 15, letterSpacing: '-0.01em' },
  pathList: { margin: 0, paddingLeft: 22, display: 'grid', gap: 10 },
  pathItem: { paddingLeft: 4 },
  emptyHint: { padding: '11px 12px', borderRadius: 10, background: '#fbfbfa', color: '#667085', border: '1px solid #e6e7e9', fontSize: 13, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: '100%', boxSizing: 'border-box' },
  noticeStack: { display: 'grid', gap: 8, marginBottom: 12 },
  readableText: { color: '#344054', lineHeight: 1.55, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' },
  summaryTextBlock: { display: 'grid', gap: 8, minWidth: 0 },
  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  subBlock: { marginTop: 14, display: 'grid', gap: 8 },
  json: { margin: 0, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: '#111827', color: '#f9fafb', borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 1.5 },
};
