import React, { useMemo, useState } from 'react';
import type { StepProps } from '../types';

type Row =
  | { type: 'mainHeader'; label: string }
  | { type: 'groupHeader'; label: string }
  | { type: 'inputRow'; label: string; currentField: string; previousField?: string; note?: string }
  | { type: 'sumRow'; label: string; currentValue: number; previousValue?: number; note?: string }
  | { type: 'finalRow'; label: string; currentValue: number; previousValue?: number; note?: string };

export default function StepGuV({ data, onChange }: StepProps) {
  const g = data.guv;
  const k = data.kennzahlen;
  const kRecord = k as Record<string, number | undefined>;

  const setG = (field: string, value: number) => onChange('guv', field, value);
  const setK = (field: string, value: number) => {
    onChange('kennzahlen', field, value);

    if (field === 'vj_material_roh' || field === 'vj_material_dienst') {
      const next = { ...kRecord, [field]: value };
      onChange('kennzahlen', 'vj_materialaufwand', (next.vj_material_roh || 0) + (next.vj_material_dienst || 0));
    }

    if (field === 'vj_loehne' || field === 'vj_sozialabgaben') {
      const next = { ...kRecord, [field]: value };
      onChange('kennzahlen', 'vj_personalaufwand', (next.vj_loehne || 0) + (next.vj_sozialabgaben || 0));
    }
  };

  const c = useMemo(() => {
    const gesamtleistung =
      (g.umsatzerloese || 0) +
      (g.bestandsveraenderung || 0) +
      (g.eigenleistungen || 0) +
      (g.sonstige_ertraege || 0);
    const previousGesamtleistung =
      (k.vorjahr_umsatz || 0) +
      (kRecord.vj_bestandsveraenderung || 0) +
      (kRecord.vj_eigenleistungen || 0) +
      (k.vj_sonstige_ertraege || 0);
    const material = (g.material_roh || 0) + (g.material_dienst || 0);
    const personal = (g.loehne || 0) + (g.sozialabgaben || 0);
    const ebitda = gesamtleistung - material - personal - (g.sonstige_aufwendungen || 0);
    const ebit = ebitda - (g.abschreibungen || 0);
    const finanzen =
      (g.beteiligungsertraege || 0) +
      (g.zinsertraege || 0) -
      (g.abschr_finanzanlagen || 0) -
      (g.zinsaufwendungen || 0);
    const steuern = (g.steuern_ertrag || 0) + (g.sonstige_steuern || 0);
    const jahresueberschuss = ebit + finanzen - steuern;

    return {
      gesamtleistung,
      previousGesamtleistung,
      material,
      personal,
      ebitda,
      ebit,
      finanzen,
      steuern,
      jahresueberschuss,
    };
  }, [g, k, kRecord]);

  const rows: Row[] = [
    { type: 'mainHeader', label: 'ERTRÄGE' },
    { type: 'inputRow', label: 'Umsatzerlöse', currentField: 'umsatzerloese', previousField: 'vorjahr_umsatz' },
    { type: 'inputRow', label: 'Bestandsveränderung (+/-)', currentField: 'bestandsveraenderung', previousField: 'vj_bestandsveraenderung' },
    { type: 'inputRow', label: 'Aktivierte Eigenleistungen', currentField: 'eigenleistungen', previousField: 'vj_eigenleistungen' },
    { type: 'inputRow', label: 'Sonstige betriebliche Erträge', currentField: 'sonstige_ertraege', previousField: 'vj_sonstige_ertraege' },
    { type: 'sumRow', label: 'GESAMTLEISTUNG', currentValue: c.gesamtleistung, previousValue: c.previousGesamtleistung },

    { type: 'groupHeader', label: 'Materialaufwand' },
    { type: 'inputRow', label: 'Roh-, Hilfs- und Betriebsstoffe / bezogene Waren', currentField: 'material_roh', previousField: 'vj_material_roh' },
    { type: 'inputRow', label: 'Bezogene Leistungen', currentField: 'material_dienst', previousField: 'vj_material_dienst' },
    { type: 'sumRow', label: 'Summe Materialaufwand', currentValue: c.material, previousValue: k.vj_materialaufwand },

    { type: 'groupHeader', label: 'Personalaufwand' },
    { type: 'inputRow', label: 'Löhne und Gehälter', currentField: 'loehne', previousField: 'vj_loehne' },
    { type: 'inputRow', label: 'Soziale Abgaben und Altersversorgung', currentField: 'sozialabgaben', previousField: 'vj_sozialabgaben' },
    { type: 'sumRow', label: 'Summe Personalaufwand', currentValue: c.personal, previousValue: k.vj_personalaufwand },

    { type: 'groupHeader', label: 'Weitere Aufwendungen' },
    { type: 'inputRow', label: 'Abschreibungen', currentField: 'abschreibungen', previousField: 'vj_abschreibungen' },
    { type: 'inputRow', label: 'Sonstige betriebliche Aufwendungen', currentField: 'sonstige_aufwendungen', previousField: 'vj_sonstige_aufwendungen' },
    { type: 'sumRow', label: 'EBITDA', currentValue: c.ebitda, previousValue: k.vorjahr_ebitda },
    { type: 'sumRow', label: 'EBIT (Betriebsergebnis)', currentValue: c.ebit, previousValue: k.vorjahr_ebit },

    { type: 'groupHeader', label: 'Finanzergebnis' },
    { type: 'inputRow', label: 'Beteiligungserträge', currentField: 'beteiligungsertraege', previousField: 'vj_beteiligungsertraege' },
    { type: 'inputRow', label: 'Zinserträge', currentField: 'zinsertraege', previousField: 'vj_zinsertraege' },
    { type: 'inputRow', label: 'Abschreibungen auf Finanzanlagen', currentField: 'abschr_finanzanlagen', previousField: 'vj_abschr_finanzanlagen', note: 'positiver Betrag' },
    { type: 'inputRow', label: 'Zinsaufwendungen', currentField: 'zinsaufwendungen', previousField: 'vj_zinsaufwand', note: 'positiver Betrag' },
    { type: 'sumRow', label: 'Summe Finanzergebnis', currentValue: c.finanzen },

    { type: 'groupHeader', label: 'Steuern' },
    { type: 'inputRow', label: 'Steuern vom Einkommen und Ertrag', currentField: 'steuern_ertrag', previousField: 'vj_steuern_ertrag' },
    { type: 'inputRow', label: 'Sonstige Steuern', currentField: 'sonstige_steuern', previousField: 'vj_sonstige_steuern' },
    { type: 'finalRow', label: 'JAHRESÜBERSCHUSS', currentValue: c.jahresueberschuss, previousValue: k.vorjahr_jahresueber },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.sheetShell}>
        <div style={styles.sheetTitle}>Gewinn- und Verlustrechnung gemäß § 275 Abs. 2 HGB</div>
        <div style={styles.sheetScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '42%' }}>Position</th>
                <th style={styles.thRight}>2025 TEUR</th>
                <th style={styles.thRight}>2024 TEUR</th>
                <th style={{ ...styles.th, width: '18%' }}>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <SheetRow
                  key={`${row.label}-${index}`}
                  row={row}
                  currentValues={g as Record<string, number | undefined>}
                  previousValues={kRecord}
                  onCurrentChange={setG}
                  onPreviousChange={setK}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SheetRow({
  row,
  currentValues,
  previousValues,
  onCurrentChange,
  onPreviousChange,
}: {
  row: Row;
  currentValues: Record<string, number | undefined>;
  previousValues: Record<string, number | undefined>;
  onCurrentChange: (field: string, value: number) => void;
  onPreviousChange: (field: string, value: number) => void;
}) {
  if (row.type === 'mainHeader') {
    return <tr><td colSpan={4} style={styles.mainHeader}>{row.label}</td></tr>;
  }

  if (row.type === 'groupHeader') {
    return <tr><td colSpan={4} style={styles.groupHeader}>{row.label}</td></tr>;
  }

  if (row.type === 'sumRow' || row.type === 'finalRow') {
    const style = row.type === 'finalRow' ? styles.finalCell : styles.sumCell;
    const labelStyle = row.type === 'finalRow' ? styles.finalLabel : styles.sumLabel;
    return (
      <tr>
        <td style={labelStyle}>{row.label}</td>
        <td style={style}>{fmt(row.currentValue)}</td>
        <td style={style}>{fmt(row.previousValue)}</td>
        <td style={style}>{row.note || ''}</td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={styles.labelCell}>{row.label}</td>
      <td style={styles.inputCell}>
        <NumberCell value={currentValues[row.currentField]} onChange={value => onCurrentChange(row.currentField, value)} />
      </td>
      <td style={styles.inputCell}>
        {row.previousField ? (
          <NumberCell value={previousValues[row.previousField]} onChange={value => onPreviousChange(row.previousField!, value)} />
        ) : null}
      </td>
      <td style={styles.noteCell}>{row.note || ''}</td>
    </tr>
  );
}

function NumberCell({ value, onChange }: { value: number | undefined; onChange: (value: number) => void }) {
  const [focused, setFocused] = useState(false);
  const safeValue = Number(value || 0);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={focused ? String(safeValue) : fmt(safeValue)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={event => onChange(parseNumber(event.target.value))}
      style={styles.input}
    />
  );
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(n: number | undefined): string {
  return Math.round(Number(n || 0)).toLocaleString('de-DE');
}

const styles: Record<string, React.CSSProperties> = {
  page: { paddingBottom: 96 },
  sheetShell: {
    border: '1px solid #D6DEEA',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#FFFFFF',
  },
  sheetTitle: {
    padding: '12px 16px',
    background: '#F8FAFC',
    borderBottom: '1px solid #D6DEEA',
    fontSize: 16,
    fontWeight: 800,
    color: '#0F2A56',
  },
  sheetScroll: { overflow: 'auto', maxHeight: 'calc(100vh - 320px)' },
  table: { width: '100%', minWidth: 860, borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#EAF1FB',
    color: '#0F2A56',
    border: '1px solid #C9D7EA',
    padding: '9px 10px',
    fontSize: 12,
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  thRight: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#EAF1FB',
    color: '#0F2A56',
    border: '1px solid #C9D7EA',
    padding: '9px 10px',
    fontSize: 12,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  mainHeader: {
    background: '#1F3864',
    color: '#FFFFFF',
    fontWeight: 800,
    padding: '10px 12px',
    border: '1px solid #1F3864',
  },
  groupHeader: {
    background: '#DDEBFA',
    color: '#0F2A56',
    fontWeight: 800,
    padding: '9px 12px',
    border: '1px solid #BCD3F0',
  },
  labelCell: {
    border: '1px solid #D6DEEA',
    padding: '8px 10px',
    color: '#1F2937',
    background: '#FFFFFF',
  },
  inputCell: { border: '1px solid #D6DEEA', padding: 0, background: '#FFF7CC' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: 0,
    outline: 'none',
    background: '#FFF7CC',
    padding: '8px 10px',
    textAlign: 'right',
    font: 'inherit',
    color: '#111827',
  },
  noteCell: {
    border: '1px solid #D6DEEA',
    padding: '8px 10px',
    color: '#64748B',
    background: '#FFFFFF',
    fontSize: 12,
    fontStyle: 'italic',
  },
  sumLabel: {
    border: '1px solid #BCD3F0',
    padding: '8px 10px',
    background: '#DDEBFA',
    color: '#0F2A56',
    fontWeight: 800,
  },
  sumCell: {
    border: '1px solid #BCD3F0',
    padding: '8px 10px',
    background: '#DDEBFA',
    color: '#0F2A56',
    fontWeight: 800,
    textAlign: 'right',
  },
  finalLabel: {
    border: '1px solid #1F3864',
    padding: '10px 12px',
    background: '#1F3864',
    color: '#FFFFFF',
    fontWeight: 800,
  },
  finalCell: {
    border: '1px solid #1F3864',
    padding: '10px 12px',
    background: '#1F3864',
    color: '#FFFFFF',
    fontWeight: 800,
    textAlign: 'right',
  },
};
