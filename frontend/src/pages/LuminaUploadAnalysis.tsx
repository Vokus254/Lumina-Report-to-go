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
  fehlende_angaben: Array<{
    prioritaet: string;
    bereich: string;
    fehlende_angabe: string;
    warum_erforderlich: string;
    beispiel_nachfrage_an_nutzer: string;
  }>;
  naechste_schritte: Array<{
    schritt?: number;
    massnahme?: string;
    ziel?: string;
    titel?: string;
  }>;
  fragen_an_nutzer: unknown[];
};

type UploadAnalysisResponse = {
  normalizedFiles: NormalizedFileContent[];
  extractionWarnings: string[];
  analysis: LuminaFileAnalysisResult;
  model: string;
  timestamp: string;
};

function asResponse(value: unknown): UploadAnalysisResponse {
  return value as UploadAnalysisResponse;
}

function statusColor(value: string | undefined): React.CSSProperties {
  const text = String(value || '').toLowerCase();
  if (text.includes('ja') || text.includes('hoch') || text.includes('plausibel')) return { background: '#eaf7ef', color: '#16794c' };
  if (text.includes('nein') || text.includes('niedrig') || text.includes('kritisch') || text.includes('zwingend')) return { background: '#fff0ee', color: '#b42318' };
  return { background: '#fff4df', color: '#a15c07' };
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre style={S.json}>{JSON.stringify(value, null, 2)}</pre>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details style={S.details}>
      <summary style={S.summary}>{title}</summary>
      <div style={S.detailBody}>{children}</div>
    </details>
  );
}

export default function LuminaUploadAnalysis() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<UploadAnalysisResponse | null>(null);

  const requiredMissing = useMemo(
    () => result?.analysis.fehlende_angaben?.filter(item => item.prioritaet === 'zwingend') ?? [],
    [result],
  );
  const nextStep = result?.analysis.naechste_schritte?.[0];

  const runAnalysis = async () => {
    if (!files.length) {
      setMessage('Bitte laden Sie mindestens eine Datei hoch.');
      return;
    }
    setStatus('loading');
    setMessage('Lumina liest die Dateien und erstellt die HGB-Diagnose...');
    setResult(null);
    try {
      const response = asResponse(await analyzeUploadedFiles(files));
      setResult(response);
      setStatus('done');
      setMessage('Analyse abgeschlossen.');
    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message);
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
          <div style={S.instant}>
            <div>
              <div style={S.kicker}>Gesamtbeurteilung</div>
              <h2 style={S.resultTitle}>{result.analysis.analyse_status.gesamtbeurteilung || 'Lumina kann weiterarbeiten.'}</h2>
              <p style={S.leadSmall}>{result.analysis.analyse_status.kurzbegruendung}</p>
            </div>
            <span style={{ ...S.badge, ...statusColor(result.analysis.analyse_status.abschlussfaehigkeit) }}>
              Abschlussfähigkeit: {result.analysis.analyse_status.abschlussfaehigkeit}
            </span>
          </div>

          <div style={S.cards}>
            <div style={S.card}>
              <div style={S.cardLabel}>Datenqualität</div>
              <strong>{result.analysis.analyse_status.datenqualitaet}</strong>
            </div>
            <div style={S.card}>
              <div style={S.cardLabel}>Zwingend fehlt</div>
              <strong>{requiredMissing.length}</strong>
            </div>
            <div style={S.card}>
              <div style={S.cardLabel}>Nächster Schritt</div>
              <strong>{nextStep?.massnahme || nextStep?.titel || 'Ergebnis prüfen'}</strong>
            </div>
          </div>

          <DetailSection title="1. Gesamtbeurteilung">
            <JsonBlock value={result.analysis.analyse_status} />
          </DetailSection>
          <DetailSection title="2. Erkannte Dateien">
            <JsonBlock value={result.analysis.dateien} />
          </DetailSection>
          <DetailSection title="3. Erkannte Gesellschaftsdaten">
            <JsonBlock value={result.analysis.gesellschaft} />
          </DetailSection>
          <DetailSection title="4. Erkannte Abschlussbestandteile">
            <JsonBlock value={result.analysis.erkannte_abschlussbestandteile} />
          </DetailSection>
          <DetailSection title="5. Bilanz / GuV / Mapping-Vorschlag">
            <JsonBlock value={{ bilanz: result.analysis.bilanz, guv: result.analysis.guv, mapping_vorschlag: result.analysis.mapping_vorschlag }} />
          </DetailSection>
          <DetailSection title="6. Auffälligkeiten">
            <JsonBlock value={result.analysis.auffaelligkeiten} />
          </DetailSection>
          <DetailSection title="7. Fehlende Angaben">
            <JsonBlock value={result.analysis.fehlende_angaben} />
          </DetailSection>
          <DetailSection title="8. Nächste Schritte">
            <JsonBlock value={result.analysis.naechste_schritte} />
          </DetailSection>
          <DetailSection title="9. Rückfragen an den Nutzer">
            <JsonBlock value={result.analysis.fragen_an_nutzer} />
          </DetailSection>
          <DetailSection title="Technische Extraktion">
            <JsonBlock value={{
              model: result.model,
              timestamp: result.timestamp,
              extractionWarnings: result.extractionWarnings,
              normalizedFiles: result.normalizedFiles,
            }} />
          </DetailSection>
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { maxWidth: 980, margin: '0 auto', padding: '34px 28px 90px', width: '100%' },
  hero: { marginBottom: 18 },
  kicker: { fontSize: 12, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 },
  title: { margin: '6px 0 10px', fontSize: 32, lineHeight: 1.12, letterSpacing: '-0.035em' },
  lead: { margin: 0, color: '#667085', lineHeight: 1.55, maxWidth: 720 },
  leadSmall: { margin: '8px 0 0', color: '#667085', lineHeight: 1.5 },
  panel: { background: '#fff', border: '1px solid #e6e7e9', borderRadius: 16, padding: 18, marginBottom: 18 },
  upload: { display: 'grid', gap: 5, placeItems: 'center', minHeight: 150, border: '1.5px dashed #d0d5dd', borderRadius: 14, background: '#fbfbfa', cursor: 'pointer', color: '#344054' },
  fileList: { marginTop: 12, display: 'grid', gap: 6 },
  fileRow: { display: 'flex', justifyContent: 'space-between', gap: 12, background: '#fbfbfa', border: '1px solid #e6e7e9', borderRadius: 10, padding: '9px 11px', fontSize: 13 },
  muted: { color: '#667085', fontSize: 12 },
  primaryBtn: { marginTop: 14, border: '1px solid #111827', background: '#111827', color: '#fff', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' },
  message: { marginTop: 12, padding: '10px 12px', background: '#eff6ff', color: '#175cd3', borderRadius: 10, fontSize: 13 },
  error: { background: '#fff0ee', color: '#b42318' },
  results: { display: 'grid', gap: 10 },
  instant: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', background: '#fff', border: '1px solid #e6e7e9', borderRadius: 16, padding: 18 },
  resultTitle: { margin: '5px 0 0', fontSize: 22, letterSpacing: '-0.02em' },
  badge: { borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 },
  card: { background: '#fff', border: '1px solid #e6e7e9', borderRadius: 14, padding: 14 },
  cardLabel: { color: '#667085', fontSize: 12, marginBottom: 5 },
  details: { background: '#fff', border: '1px solid #e6e7e9', borderRadius: 14, overflow: 'hidden' },
  summary: { padding: '12px 14px', cursor: 'pointer', fontWeight: 700 },
  detailBody: { borderTop: '1px solid #e6e7e9', padding: 14 },
  json: { margin: 0, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', background: '#111827', color: '#f9fafb', borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 1.5 },
};
