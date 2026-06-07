import { useState, useCallback, useRef } from 'react';
import type { JahresabschlussData, ReportTextEntry } from '../types';
import { DEFAULT_DATA } from '../utils/defaultData';
import { importExcelClient } from '../utils/importExcelClient';
import { apiUrl } from '../utils/api';

export type GenerateStatus = 'idle' | 'generating' | 'done' | 'error';
export type ImportStatus   = 'idle' | 'loading' | 'done' | 'error';

const REQUIRED_REPORT_TEXTS = [
  'anhang.immaterielle_vermoegenswerte',
  'anhang.sachanlagen',
  'anhang.finanzanlagen',
  'anhang.vorraete',
  'anhang.forderungen',
  'anhang.wertpapiere_uv',
  'anhang.liquide_mittel',
  'anhang.eigenkapital',
  'anhang.rueckstellungen',
  'anhang.verbindlichkeiten',
  'anhang.guv.umsatzerloese',
  'anhang.guv.materialaufwand',
  'anhang.guv.personalaufwand',
  'anhang.guv.abschreibungen',
  'anhang.guv.sonstige_betriebliche_ertraege',
  'anhang.guv.sonstige_betriebliche_aufwendungen',
];

export function useJahresabschluss() {
  const [data, setData]               = useState<JahresabschlussData>(DEFAULT_DATA);
  const [step, setStep]               = useState(0);
  const [status, setStatus]           = useState<GenerateStatus>('idle');
  const [errorMsg, setErrorMsg]       = useState('');
  const [loadingMsg, setLoadingMsg]   = useState('');
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importMsg, setImportMsg]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Field change ─────────────────────────────────────────────────
  const onChange = useCallback((section: string, field: string, value: string | number) => {
    setData((prev: any) => ({
      ...prev,
      [section]: { ...(prev as Record<string, unknown>)[section] as Record<string, unknown>, [field]: value },
    }));
  }, []);

  const onArrayChange = useCallback((path: string, index: number, field: string, value: string | number) => {
    setData((prev: any) => {
      const parts = path.split('.');
      const d = prev as unknown as Record<string, unknown>;
      if (parts.length === 1) {
        const arr = [...(d[path] as unknown[])];
        arr[index] = { ...(arr[index] as Record<string, unknown>), [field]: value };
        return { ...prev, [path]: arr };
      }
      const [section, key] = parts;
      const sec = d[section] as Record<string, unknown>;
      const arr = [...(sec[key] as unknown[])];
      arr[index] = { ...(arr[index] as Record<string, unknown>), [field]: value };
      return { ...prev, [section]: { ...sec, [key]: arr } };
    });
  }, []);

  const onAddItem = useCallback((path: string, template: Record<string, unknown>) => {
    setData((prev: any) => {
      const parts = path.split('.');
      const d = prev as unknown as Record<string, unknown>;
      if (parts.length === 1) return { ...prev, [path]: [...(d[path] as unknown[]), { ...template }] };
      const [section, key] = parts;
      const sec = d[section] as Record<string, unknown>;
      return { ...prev, [section]: { ...sec, [key]: [...(sec[key] as unknown[]), { ...template }] } };
    });
  }, []);

  const onRemoveItem = useCallback((path: string, index: number) => {
    setData((prev: any) => {
      const parts = path.split('.');
      const d = prev as unknown as Record<string, unknown>;
      if (parts.length === 1) return { ...prev, [path]: (d[path] as unknown[]).filter((_, i) => i !== index) };
      const [section, key] = parts;
      const sec = d[section] as Record<string, unknown>;
      return { ...prev, [section]: { ...sec, [key]: (sec[key] as unknown[]).filter((_, i) => i !== index) } };
    });
  }, []);

  const onTransferReportText = useCallback((entry: ReportTextEntry) => {
    setData((prev: any) => ({
      ...prev,
      reportTexts: {
        ...(prev.reportTexts ?? {}),
        [entry.sectionId]: entry,
      },
    }));
  }, []);
  // Excel Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('loading');
    setImportMsg('Excel wird eingelesen...');
    try {
      const imported = await importExcelClient(file);
      setData((prev: any) => ({
        ...prev,
        stammdaten: { ...prev.stammdaten, ...imported.stammdaten },
        segmente:   imported.segmente.length > 0 ? imported.segmente : prev.segmente,
        guv:        { ...prev.guv,   ...imported.guv },
        bilanz:     { ...prev.bilanz,...imported.bilanz },
        kennzahlen: { ...prev.kennzahlen, ...imported.kennzahlen },
        organe: {
          vorstand:    imported.organe.vorstand.length    > 0 ? imported.organe.vorstand    : prev.organe.vorstand,
          aufsichtsrat:imported.organe.aufsichtsrat.length > 0 ? imported.organe.aufsichtsrat : prev.organe.aufsichtsrat,
        },
      }));
      setImportStatus('done');
      setImportMsg(`✓ "${file.name}" eingelesen – alle Felder befüllt`);
      setStep(0);
    } catch (err) {
      setImportStatus('error');
      console.error(err);
      setImportMsg('Excel-Datei konnte nicht importiert werden.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };
  // Generate
  const generate = async () => {
    const missingReportTexts = REQUIRED_REPORT_TEXTS.filter(sectionId => !data.reportTexts?.[sectionId]);
    if (missingReportTexts.length > 0) {
      const message = 'Nicht alle Abschnittstexte wurden in den Bericht übernommen. Der Export verwendet für diese Abschnitte Fallback-/Standardtexte.';
      window.alert(message);
      setErrorMsg(message);
      setStatus('error');
      return;
    }

    setStatus('generating');
    setErrorMsg('');
    const messages = [
      'Claude liest Ihre Finanzdaten...',
      'Lagebericht wird formuliert...',
      'Bilanz und GuV werden strukturiert...',
      'Anhang wird zusammengestellt...',
      'Word-Dokumente werden gerendert...',
      'ZIP wird erstellt...',
    ];
    let mi = 0;
    setLoadingMsg(messages[0]);
    const timer = setInterval(() => { mi = (mi + 1) % messages.length; setLoadingMsg(messages[mi]); }, 4000);
    try {
      const resp = await fetch(apiUrl('/api/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      clearInterval(timer);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText })) as { error?: string };
        throw new Error(err.error ?? resp.statusText);
      }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const company = (data.stammdaten.firmenname || 'Jahresabschluss').replace(/\s+/g, '_');
      a.href     = url;
      a.download = `${company}_Jahresabschluss_${data.stammdaten.geschaeftsjahr}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch (err) {
      clearInterval(timer);
      setErrorMsg((err as Error).message);
      setStatus('error');
    }
  };

  return {
    data, step, setStep,
    status, errorMsg, loadingMsg,
    importStatus, importMsg, fileRef,
    onChange, onArrayChange, onAddItem, onRemoveItem,
    onTransferReportText,
    handleImport, generate,
  };
}
