import React, { useState } from 'react';
import type { StepProps } from '../types';

export default function StepSegmente({ data, onArrayChange, onAddItem, onRemoveItem }: StepProps) {
  return (
    <div style={styles.page}>
      <Sheet title="Operative Segmente (bis zu 5)">
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '34%' }}>Segment-Name</th>
              <th style={styles.thRight}>Umsatz {data.stammdaten.geschaeftsjahr} TEUR</th>
              <th style={styles.thRight}>Umsatz 2024 TEUR</th>
              <th style={{ ...styles.th, width: '22%' }}>Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {data.segmente.map((seg: any, index: number) => (
              <tr key={`segment-${index}`}>
                <td style={styles.inputCell}>
                  <TextCell value={seg.name} onChange={value => onArrayChange('segmente', index, 'name', value)} />
                </td>
                <td style={styles.inputCell}>
                  <NumberCell value={seg.umsatz} onChange={value => onArrayChange('segmente', index, 'umsatz', value)} />
                </td>
                <td style={styles.inputCell}>
                  <NumberCell value={seg.vorjahr_umsatz} onChange={value => onArrayChange('segmente', index, 'vorjahr_umsatz', value)} />
                </td>
                <td style={styles.actionCell}>
                  <span style={styles.hint}>Segment {index + 1}</span>
                  {data.segmente.length > 1 && (
                    <button style={styles.removeBtn} onClick={() => onRemoveItem('segmente', index)}>Entfernen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.segmente.length < 5 && (
          <button style={styles.addBtn} onClick={() => onAddItem('segmente', { name: '', umsatz: 0, vorjahr_umsatz: 0 })}>
            + Segment hinzufügen
          </button>
        )}
      </Sheet>

      <Sheet title="Vorstand (bis zu 5 Mitglieder)">
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '30%' }}>Name</th>
              <th style={styles.th}>Funktion</th>
              <th style={{ ...styles.th, width: '20%' }}>Bestellt bis</th>
              <th style={{ ...styles.th, width: '18%' }}>Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {data.organe.vorstand.map((person: any, index: number) => (
              <tr key={`vorstand-${index}`}>
                <td style={styles.inputCell}>
                  <TextCell value={person.name} onChange={value => onArrayChange('organe.vorstand', index, 'name', value)} />
                </td>
                <td style={styles.inputCell}>
                  <TextCell value={person.funktion} onChange={value => onArrayChange('organe.vorstand', index, 'funktion', value)} />
                </td>
                <td style={styles.inputCell}>
                  <TextCell value={person.bestellt_bis ?? ''} onChange={value => onArrayChange('organe.vorstand', index, 'bestellt_bis', value)} />
                </td>
                <td style={styles.actionCell}>
                  <span style={styles.hint}>Mitglied {index + 1}</span>
                  {data.organe.vorstand.length > 1 && (
                    <button style={styles.removeBtn} onClick={() => onRemoveItem('organe.vorstand', index)}>Entfernen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.organe.vorstand.length < 5 && (
          <button style={styles.addBtn} onClick={() => onAddItem('organe.vorstand', { name: '', funktion: '', bestellt_bis: '' })}>
            + Vorstandsmitglied hinzufügen
          </button>
        )}
      </Sheet>

      <Sheet title="Aufsichtsrat (bis zu 6 Mitglieder)">
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '36%' }}>Name</th>
              <th style={styles.th}>Funktion</th>
              <th style={{ ...styles.th, width: '22%' }}>Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {data.organe.aufsichtsrat.map((person: any, index: number) => (
              <tr key={`aufsichtsrat-${index}`}>
                <td style={styles.inputCell}>
                  <TextCell value={person.name} onChange={value => onArrayChange('organe.aufsichtsrat', index, 'name', value)} />
                </td>
                <td style={styles.inputCell}>
                  <TextCell value={person.funktion} onChange={value => onArrayChange('organe.aufsichtsrat', index, 'funktion', value)} />
                </td>
                <td style={styles.actionCell}>
                  <span style={styles.hint}>Mitglied {index + 1}</span>
                  {data.organe.aufsichtsrat.length > 1 && (
                    <button style={styles.removeBtn} onClick={() => onRemoveItem('organe.aufsichtsrat', index)}>Entfernen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.organe.aufsichtsrat.length < 6 && (
          <button style={styles.addBtn} onClick={() => onAddItem('organe.aufsichtsrat', { name: '', funktion: '' })}>
            + AR-Mitglied hinzufügen
          </button>
        )}
      </Sheet>

      <Sheet title="Wesentliche Beteiligungen (für Anhang)">
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '26%' }}>Gesellschaft</th>
              <th style={{ ...styles.th, width: '18%' }}>Sitz</th>
              <th style={{ ...styles.th, width: '14%' }}>Anteil %</th>
              <th style={styles.thRight}>Eigenkapital TEUR</th>
              <th style={styles.thRight}>Ergebnis TEUR</th>
              <th style={{ ...styles.th, width: '16%' }}>Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {data.beteiligungen.map((beteiligung: any, index: number) => (
              <tr key={`beteiligung-${index}`}>
                <td style={styles.inputCell}>
                  <TextCell value={beteiligung.name} onChange={value => onArrayChange('beteiligungen', index, 'name', value)} />
                </td>
                <td style={styles.inputCell}>
                  <TextCell value={beteiligung.sitz} onChange={value => onArrayChange('beteiligungen', index, 'sitz', value)} />
                </td>
                <td style={styles.inputCell}>
                  <TextCell value={beteiligung.anteil} onChange={value => onArrayChange('beteiligungen', index, 'anteil', value)} />
                </td>
                <td style={styles.inputCell}>
                  <NumberCell value={beteiligung.eigenkapital} onChange={value => onArrayChange('beteiligungen', index, 'eigenkapital', value)} />
                </td>
                <td style={styles.inputCell}>
                  <NumberCell value={beteiligung.ergebnis} onChange={value => onArrayChange('beteiligungen', index, 'ergebnis', value)} />
                </td>
                <td style={styles.actionCell}>
                  <span style={styles.hint}>Anhang</span>
                  <button style={styles.removeBtn} onClick={() => onRemoveItem('beteiligungen', index)}>Entfernen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button style={styles.addBtn} onClick={() => onAddItem('beteiligungen', { name: '', sitz: '', anteil: '', eigenkapital: 0, ergebnis: 0 })}>
          + Beteiligung hinzufügen
        </button>
      </Sheet>
    </div>
  );
}

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={styles.sheetShell}>
      <div style={styles.title}>{title}</div>
      <div style={styles.sheetScroll}>{children}</div>
    </section>
  );
}

function TextCell({ value, onChange }: { value: string | number | undefined; onChange: (value: string) => void }) {
  return (
    <input
      value={String(value ?? '')}
      onChange={event => onChange(event.target.value)}
      style={styles.textInput}
    />
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
    border: '1px solid #D6DEEA',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#FFFFFF',
    marginBottom: 16,
  },
  title: {
    background: '#1F3864',
    color: '#FFFFFF',
    fontWeight: 800,
    padding: '10px 14px',
    fontSize: 14,
  },
  sheetScroll: { overflowX: 'auto' },
  table: { width: '100%', minWidth: 780, borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    background: '#2E75B6',
    color: '#FFFFFF',
    border: '1px solid #245B8F',
    padding: '8px 10px',
    fontSize: 12,
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  thRight: {
    background: '#2E75B6',
    color: '#FFFFFF',
    border: '1px solid #245B8F',
    padding: '8px 10px',
    fontSize: 12,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  inputCell: {
    border: '1px solid #D6DEEA',
    padding: 0,
    background: '#FFF7CC',
  },
  textInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: 0,
    outline: 'none',
    background: '#FFF7CC',
    padding: '8px 10px',
    font: 'inherit',
    color: '#111827',
  },
  numberInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: 0,
    outline: 'none',
    background: '#FFF7CC',
    padding: '8px 10px',
    font: 'inherit',
    color: '#111827',
    textAlign: 'right',
  },
  actionCell: {
    border: '1px solid #D6DEEA',
    padding: '6px 8px',
    background: '#FFFFFF',
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hint: { color: '#64748B' },
  addBtn: {
    background: '#EBF3FB',
    border: '1px dashed #2E75B6',
    color: '#1F3864',
    borderRadius: 0,
    padding: '8px 12px',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 700,
    width: '100%',
  },
  removeBtn: {
    background: '#FFFFFF',
    border: '1px solid #FCA5A5',
    color: '#B91C1C',
    borderRadius: 4,
    padding: '3px 7px',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
