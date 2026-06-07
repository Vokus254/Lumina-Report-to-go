import React, { useState } from 'react';
import type { StepProps } from '../types';

type StammdatenRow = {
  label: string;
  field: string;
  hint: string;
  numeric?: boolean;
};

const rows: StammdatenRow[] = [
  { label: 'Firmenname', field: 'firmenname', hint: 'z.B. Müller AG' },
  { label: 'Sitz', field: 'sitz', hint: 'z.B. Duisburg' },
  { label: 'Handelsregister (HRB)', field: 'handelsregister', hint: 'z.B. HRB 12345' },
  { label: 'Gründungsjahr', field: 'gruendungsjahr', hint: 'z.B. 1995' },
  { label: 'Geschäftsjahr', field: 'geschaeftsjahr', hint: 'z.B. 2025' },
  { label: 'Branche / Industrie', field: 'branche', hint: 'z.B. Industrieautomation' },
  { label: 'Standorte und Länder', field: 'mitarbeiter_standorte', hint: 'z.B. 12 Standorte in 5 Ländern' },
  { label: 'Börsensegment', field: 'boerse', hint: 'z.B. Prime Standard, Frankfurt' },
  { label: 'ISIN', field: 'isin', hint: 'z.B. DE000ABC1234' },
  { label: 'Ticker', field: 'ticker', hint: 'z.B. LUM' },
  { label: 'Anzahl Aktien', field: 'anzahl_aktien', hint: 'in Stück', numeric: true },
  { label: 'Abschlussprüfer', field: 'abschlussprufer', hint: 'z.B. KPMG AG' },
];

export default function StepStammdaten({ data, onChange }: StepProps) {
  const s = data.stammdaten as unknown as Record<string, string | number | undefined>;

  return (
    <div style={styles.page}>
      <div style={styles.sheetShell}>
        <div style={styles.title}>Stammdaten der Gesellschaft</div>
        <div style={styles.sheetScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '34%' }}>Feld</th>
                <th style={styles.th}>Wert / Eingabe</th>
                <th style={{ ...styles.th, width: '30%' }}>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.field}>
                  <td style={styles.labelCell}>{row.label}</td>
                  <td style={styles.inputCell}>
                    {row.numeric ? (
                      <NumberCell
                        value={Number(s[row.field] || 0)}
                        onChange={value => onChange('stammdaten', row.field, value)}
                      />
                    ) : (
                      <input
                        value={String(s[row.field] ?? '')}
                        onChange={event => onChange('stammdaten', row.field, event.target.value)}
                        style={styles.textInput}
                      />
                    )}
                  </td>
                  <td style={styles.hintCell}>{row.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NumberCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={focused ? String(Number(value || 0)) : fmt(value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={event => onChange(parseNumber(event.target.value))}
      style={styles.numberInput}
    />
  );
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value: number | undefined): string {
  return Math.round(Number(value || 0)).toLocaleString('de-DE');
}

const styles: Record<string, React.CSSProperties> = {
  page: { paddingBottom: 96 },
  sheetShell: {
    border: '1px solid #E6E7E9',
    borderRadius: 16,
    overflow: 'hidden',
    background: '#FFFFFF',
  },
  title: {
    background: '#FAFAFA',
    color: '#17212F',
    fontWeight: 800,
    padding: '12px 16px',
    fontSize: 15,
    borderBottom: '1px solid #E6E7E9',
  },
  sheetScroll: { overflow: 'auto', maxHeight: 'calc(100vh - 320px)' },
  table: { width: '100%', minWidth: 760, borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#FCFCFC',
    color: '#667085',
    border: '1px solid #E6E7E9',
    padding: '7px 10px',
    fontSize: 11,
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  labelCell: {
    border: '1px solid #E6E7E9',
    padding: '7px 10px',
    color: '#1F2937',
    background: '#FFFFFF',
    fontWeight: 700,
    fontSize: 13,
  },
  inputCell: {
    border: '1px solid #E6E7E9',
    padding: 0,
    background: '#FFFCEB',
  },
  textInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: 0,
    outline: 'none',
    background: '#FFFCEB',
    padding: '7px 10px',
    font: 'inherit',
    fontSize: 13,
    color: '#111827',
    textAlign: 'left',
  },
  numberInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: 0,
    outline: 'none',
    background: '#FFFCEB',
    padding: '7px 10px',
    font: 'inherit',
    fontSize: 13,
    color: '#111827',
    textAlign: 'right',
  },
  hintCell: {
    border: '1px solid #E6E7E9',
    padding: '7px 10px',
    color: '#64748B',
    background: '#FCFCFC',
    fontSize: 12,
    fontStyle: 'italic',
  },
};
