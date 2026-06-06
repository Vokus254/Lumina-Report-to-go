import React, { useMemo, useState } from 'react';
import type { StepProps } from '../types';

type Row =
  | { type: 'mainHeader'; label: string }
  | { type: 'groupHeader'; label: string }
  | { type: 'inputRow'; label: string; currentField: string; previousField?: string; note?: string }
  | { type: 'sumRow'; label: string; currentValue: number; previousValue?: number; note?: string }
  | { type: 'finalRow'; label: string; currentValue: number; previousValue?: number; note?: string };

export default function StepBilanz({ data, onChange }: StepProps) {
  const b = data.bilanz;

  const totals = useMemo(() => calculateTotals(b as Record<string, number | undefined>), [b]);
  const balanced = Math.abs(totals.diff) < 2;

  const set = (field: string, value: number) => {
    onChange('bilanz', field, value);

    const next = { ...(b as Record<string, number | undefined>), [field]: value };
    const nextTotals = calculateTotals(next);

    const updates: Record<string, number> = {};
    if (['immat_lizenzen', 'immat_selbst', 'immat_anzahlungen'].includes(field)) updates.immat_vw = nextTotals.immat;
    if (['sach_gebaeude', 'sach_maschinen', 'sach_ausstattung', 'sach_anbau'].includes(field)) updates.sachanlagen = nextTotals.sach;
    if (['fin_anteilsvbu', 'fin_ausleihvbu', 'fin_beteiligungen'].includes(field)) updates.finanzanlagen = nextTotals.finanz;
    if (['vorr_rhb', 'vorr_unfertig', 'vorr_fertig', 'vorr_anzahlungen'].includes(field)) updates.vorraete = nextTotals.vorraete;
    if (['ford_llg', 'ford_vbu', 'ford_sonstige'].includes(field)) updates.forderungen_gesamt = nextTotals.forderungen;

    Object.entries(updates).forEach(([key, nextValue]) => onChange('bilanz', key, nextValue));
  };

  const rows: Row[] = [
    { type: 'mainHeader', label: 'AKTIVA' },
    { type: 'groupHeader', label: 'A. Anlagevermögen' },
    { type: 'groupHeader', label: 'I. Immaterielle Vermögenswerte' },
    { type: 'inputRow', label: 'Konzessionen, Lizenzen, Rechte', currentField: 'immat_lizenzen', previousField: 'vj_immat_lizenzen' },
    { type: 'inputRow', label: 'Selbst erstellte immaterielle Vermögenswerte', currentField: 'immat_selbst', previousField: 'vj_immat_selbst' },
    { type: 'inputRow', label: 'Geleistete Anzahlungen immateriell', currentField: 'immat_anzahlungen', previousField: 'vj_immat_anzahlungen' },
    { type: 'sumRow', label: 'Summe immaterielle Vermögenswerte', currentValue: totals.immat, previousValue: b.vj_immat_vw },

    { type: 'groupHeader', label: 'II. Sachanlagen' },
    { type: 'inputRow', label: 'Grundstücke und Gebäude', currentField: 'sach_gebaeude', previousField: 'vj_sach_gebaeude' },
    { type: 'inputRow', label: 'Technische Anlagen und Maschinen', currentField: 'sach_maschinen', previousField: 'vj_sach_maschinen' },
    { type: 'inputRow', label: 'Betriebs- und Geschäftsausstattung', currentField: 'sach_ausstattung', previousField: 'vj_sach_ausstattung' },
    { type: 'inputRow', label: 'Anlagen im Bau / Anzahlungen', currentField: 'sach_anbau', previousField: 'vj_sach_anbau' },
    { type: 'sumRow', label: 'Summe Sachanlagen', currentValue: totals.sach, previousValue: b.vj_sachanlagen },

    { type: 'groupHeader', label: 'III. Finanzanlagen' },
    { type: 'inputRow', label: 'Anteile an verbundenen Unternehmen', currentField: 'fin_anteilsvbu', previousField: 'vj_fin_anteilsvbu' },
    { type: 'inputRow', label: 'Ausleihungen an verbundene Unternehmen', currentField: 'fin_ausleihvbu', previousField: 'vj_fin_ausleihvbu' },
    { type: 'inputRow', label: 'Beteiligungen', currentField: 'fin_beteiligungen', previousField: 'vj_fin_beteiligungen' },
    { type: 'sumRow', label: 'Summe Finanzanlagen', currentValue: totals.finanz, previousValue: b.vj_finanzanlagen },
    { type: 'finalRow', label: 'SUMME ANLAGEVERMÖGEN', currentValue: totals.anlage, previousValue: b.vj_anlagevermoegen },

    { type: 'groupHeader', label: 'B. Umlaufvermögen' },
    { type: 'groupHeader', label: 'I. Vorräte' },
    { type: 'inputRow', label: 'Roh-, Hilfs- und Betriebsstoffe', currentField: 'vorr_rhb', previousField: 'vj_vorr_rhb' },
    { type: 'inputRow', label: 'Unfertige Erzeugnisse', currentField: 'vorr_unfertig', previousField: 'vj_vorr_unfertig' },
    { type: 'inputRow', label: 'Fertige Erzeugnisse und Waren', currentField: 'vorr_fertig', previousField: 'vj_vorr_fertig' },
    { type: 'inputRow', label: 'Geleistete Anzahlungen Vorräte', currentField: 'vorr_anzahlungen', previousField: 'vj_vorr_anzahlungen' },
    { type: 'sumRow', label: 'Summe Vorräte', currentValue: totals.vorraete, previousValue: b.vj_vorraete },

    { type: 'groupHeader', label: 'II. Forderungen' },
    { type: 'inputRow', label: 'Forderungen aus Lieferungen und Leistungen', currentField: 'ford_llg', previousField: 'vj_ford_llg' },
    { type: 'inputRow', label: 'Forderungen gegen verbundene Unternehmen', currentField: 'ford_vbu', previousField: 'vj_ford_vbu' },
    { type: 'inputRow', label: 'Sonstige Vermögensgegenstände', currentField: 'ford_sonstige', previousField: 'vj_ford_sonstige' },
    { type: 'sumRow', label: 'Summe Forderungen', currentValue: totals.forderungen, previousValue: b.vj_forderungen },

    { type: 'groupHeader', label: 'III. Wertpapiere des Umlaufvermögens' },
    { type: 'inputRow', label: 'Wertpapiere des Umlaufvermögens', currentField: 'wertpapiere_umlauf', previousField: 'vj_wertpapiere' },
    { type: 'groupHeader', label: 'IV. Liquide Mittel' },
    { type: 'inputRow', label: 'Liquide Mittel', currentField: 'liquide_mittel', previousField: 'vj_liquide_mittel' },
    { type: 'finalRow', label: 'SUMME UMLAUFVERMÖGEN', currentValue: totals.umlauf, previousValue: b.vj_umlaufvermoegen },
    { type: 'inputRow', label: 'C. Aktiver Rechnungsabgrenzungsposten', currentField: 'aktiver_rao', previousField: 'vj_aktiver_rao' },
    { type: 'inputRow', label: 'D. Aktive latente Steuern', currentField: 'aktive_latente_steuern', previousField: 'vj_aktive_latente' },
    { type: 'finalRow', label: 'BILANZSUMME AKTIVA', currentValue: totals.aktiva, previousValue: b.vj_bilanzsumme },

    { type: 'mainHeader', label: 'PASSIVA' },
    { type: 'groupHeader', label: 'A. Eigenkapital' },
    { type: 'inputRow', label: 'Gezeichnetes Kapital', currentField: 'gezeichnetes_kapital', previousField: 'vj_ez_kapital' },
    { type: 'inputRow', label: 'Kapitalrücklage', currentField: 'kapitalruecklage', previousField: 'vj_kapruecklage' },
    { type: 'inputRow', label: 'Gesetzliche Rücklage', currentField: 'gesetzliche_ruecklage', previousField: 'vj_gesetzliche_ruecklage' },
    { type: 'inputRow', label: 'Andere Gewinnrücklagen', currentField: 'andere_gewinnruecklagen', previousField: 'vj_andere_gewinnrueckl' },
    { type: 'inputRow', label: 'Bilanzgewinn', currentField: 'bilanzgewinn', previousField: 'vj_bilanzgewinn' },
    { type: 'sumRow', label: 'Summe Eigenkapital', currentValue: totals.eigenkapital, previousValue: b.vj_eigenkapital },

    { type: 'groupHeader', label: 'B. Rückstellungen' },
    { type: 'inputRow', label: 'Pensionsrückstellungen', currentField: 'pensionsrueckstellungen', previousField: 'vj_pensionsrueck' },
    { type: 'inputRow', label: 'Steuerrückstellungen', currentField: 'steuerrueckstellungen', previousField: 'vj_steuerrueck' },
    { type: 'inputRow', label: 'Sonstige Rückstellungen', currentField: 'sonstige_rueckstellungen', previousField: 'vj_sonstige_rueck' },
    { type: 'sumRow', label: 'Summe Rückstellungen', currentValue: totals.rueckstellungen, previousValue: b.vj_rueckstellungen },

    { type: 'groupHeader', label: 'C. Verbindlichkeiten' },
    { type: 'inputRow', label: 'Anleihen', currentField: 'anleihen', previousField: 'vj_anleihen' },
    { type: 'inputRow', label: 'Verbindlichkeiten gegenüber Kreditinstituten', currentField: 'verbindlichkeiten_kreditinstitute', previousField: 'vj_verb_kreditinst' },
    { type: 'inputRow', label: 'Erhaltene Anzahlungen', currentField: 'erhaltene_anzahlungen', previousField: 'vj_erh_anzahlungen' },
    { type: 'inputRow', label: 'Verbindlichkeiten aus Lieferungen und Leistungen', currentField: 'verbindlichkeiten_llg', previousField: 'vj_verb_llg' },
    { type: 'inputRow', label: 'Verbindlichkeiten gegenüber verbundenen Unternehmen', currentField: 'verbindlichkeiten_vbu', previousField: 'vj_verb_vbu' },
    { type: 'inputRow', label: 'Sonstige Verbindlichkeiten', currentField: 'sonstige_verbindlichkeiten', previousField: 'vj_sonst_verb' },
    { type: 'sumRow', label: 'Summe Verbindlichkeiten', currentValue: totals.verbindlichkeiten, previousValue: b.vj_verbindlichkeiten },
    { type: 'inputRow', label: 'D. Passiver Rechnungsabgrenzungsposten', currentField: 'passiver_rao', previousField: 'vj_passiver_rao' },
    { type: 'finalRow', label: 'BILANZSUMME PASSIVA', currentValue: totals.passiva, previousValue: b.vj_bilanzsumme },
  ];

  return (
    <div style={styles.page}>
      <div style={{ ...styles.balanceBar, background: balanced ? '#D1FAE5' : '#FEE2E2', borderColor: balanced ? '#6EE7B7' : '#FCA5A5' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: balanced ? '#065F46' : '#991B1B' }}>
          {balanced ? '✓ Bilanz ausgeglichen' : `Differenz: ${fmt(totals.diff)} TEUR`}
        </span>
        <span style={{ fontSize: 12, color: '#374151' }}>
          Aktiva: {fmt(totals.aktiva)} TEUR | Passiva: {fmt(totals.passiva)} TEUR
        </span>
      </div>

      <div style={styles.sheetShell}>
        <div style={styles.sheetTitle}>Bilanz</div>
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
                  values={b as Record<string, number | undefined>}
                  onChange={set}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function calculateTotals(b: Record<string, number | undefined>) {
  const immat = (b.immat_lizenzen || 0) + (b.immat_selbst || 0) + (b.immat_anzahlungen || 0);
  const sach = (b.sach_gebaeude || 0) + (b.sach_maschinen || 0) + (b.sach_ausstattung || 0) + (b.sach_anbau || 0);
  const finanz = (b.fin_anteilsvbu || 0) + (b.fin_ausleihvbu || 0) + (b.fin_beteiligungen || 0);
  const anlage = immat + sach + finanz;
  const vorraete = (b.vorr_rhb || 0) + (b.vorr_unfertig || 0) + (b.vorr_fertig || 0) + (b.vorr_anzahlungen || 0);
  const forderungen = (b.ford_llg || 0) + (b.ford_vbu || 0) + (b.ford_sonstige || 0);
  const umlauf = vorraete + forderungen + (b.wertpapiere_umlauf || 0) + (b.liquide_mittel || 0);
  const aktiva = anlage + umlauf + (b.aktiver_rao || 0) + (b.aktive_latente_steuern || 0);
  const eigenkapital =
    (b.gezeichnetes_kapital || 0) +
    (b.kapitalruecklage || 0) +
    (b.gesetzliche_ruecklage || 0) +
    (b.andere_gewinnruecklagen || 0) +
    (b.bilanzgewinn || 0);
  const rueckstellungen = (b.pensionsrueckstellungen || 0) + (b.steuerrueckstellungen || 0) + (b.sonstige_rueckstellungen || 0);
  const verbindlichkeiten =
    (b.anleihen || 0) +
    (b.verbindlichkeiten_kreditinstitute || 0) +
    (b.erhaltene_anzahlungen || 0) +
    (b.verbindlichkeiten_llg || 0) +
    (b.verbindlichkeiten_vbu || 0) +
    (b.sonstige_verbindlichkeiten || 0);
  const passiva = eigenkapital + rueckstellungen + verbindlichkeiten + (b.passiver_rao || 0);
  return { immat, sach, finanz, anlage, vorraete, forderungen, umlauf, aktiva, eigenkapital, rueckstellungen, verbindlichkeiten, passiva, diff: aktiva - passiva };
}

function SheetRow({ row, values, onChange }: { row: Row; values: Record<string, number | undefined>; onChange: (field: string, value: number) => void }) {
  if (row.type === 'mainHeader') {
    return <tr><td colSpan={4} style={styles.mainHeader}>{row.label}</td></tr>;
  }

  if (row.type === 'groupHeader') {
    return <tr><td colSpan={4} style={styles.groupHeader}>{row.label}</td></tr>;
  }

  if (row.type === 'sumRow' || row.type === 'finalRow') {
    const valueStyle = row.type === 'finalRow' ? styles.finalCell : styles.sumCell;
    const labelStyle = row.type === 'finalRow' ? styles.finalLabel : styles.sumLabel;
    return (
      <tr>
        <td style={labelStyle}>{row.label}</td>
        <td style={valueStyle}>{fmt(row.currentValue)}</td>
        <td style={valueStyle}>{fmt(row.previousValue)}</td>
        <td style={valueStyle}>{row.note || ''}</td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={styles.labelCell}>{row.label}</td>
      <td style={styles.inputCell}>
        <NumberCell value={values[row.currentField]} onChange={value => onChange(row.currentField, value)} />
      </td>
      <td style={styles.inputCell}>
        {row.previousField ? <NumberCell value={values[row.previousField]} onChange={value => onChange(row.previousField!, value)} /> : null}
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
  balanceBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid',
    marginBottom: 18,
  },
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
  table: { width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' },
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
