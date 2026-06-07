/**
 * Excel Import Service — TypeScript
 *
 * Liest die Eingabevorlage (xlsx) und mappt alle Felder auf JahresabschlussData.
 * Rückgabewert wird gegen JahresabschlussPartialSchema validiert.
 */
import * as XLSX from 'xlsx';
import type { JahresabschlussData } from '../types';

type AnyObject = Record<string, unknown>;

// ── VJ-Mappings Bilanz ───────────────────────────────────────────────────────
const CURRENT_TO_VJ: Record<string, string> = {
  // Aktiva – Immat.
  'bilanz.immat_lizenzen':  'vj_immat_lizenzen',
  'bilanz.immat_selbst':    'vj_immat_selbst',
  'bilanz.immat_anzahlungen': 'vj_immat_anzahlungen',
  // Aktiva – Sachanlagen
  'bilanz.sach_gebaeude':   'vj_sach_gebaeude',
  'bilanz.sach_maschinen':  'vj_sach_maschinen',
  'bilanz.sach_ausstattung': 'vj_sach_ausstattung',
  'bilanz.sach_anbau':      'vj_sach_anbau',
  // Aktiva – Finanzanlagen
  'bilanz.fin_anteilsvbu':  'vj_fin_anteilsvbu',
  'bilanz.fin_ausleihvbu':  'vj_fin_ausleihvbu',
  'bilanz.fin_beteiligungen': 'vj_fin_beteiligungen',
  // Aktiva – Vorräte (Anhang B.2)
  'bilanz.vorr_rhb':        'vj_vorr_rhb',
  'bilanz.vorr_unfertig':   'vj_vorr_unfertig',
  'bilanz.vorr_fertig':     'vj_vorr_fertig',
  'bilanz.vorr_anzahlungen': 'vj_vorr_anzahlungen',
  // Aktiva – Forderungen
  'bilanz.ford_llg':        'vj_ford_llg',
  'bilanz.ford_vbu':        'vj_ford_vbu',
  'bilanz.ford_sonstige':   'vj_ford_sonstige',
  // Aktiva – Sonstiges
  'bilanz.wertpapiere_umlauf': 'vj_wertpapiere',
  'bilanz.liquide_mittel':  'vj_liquide_mittel',
  'bilanz.aktiver_rao':     'vj_aktiver_rao',
  'bilanz.aktive_latente_steuern': 'vj_aktive_latente',
  // Passiva – Eigenkapital (Anhang B.4)
  'bilanz.gezeichnetes_kapital': 'vj_ez_kapital',
  'bilanz.kapitalruecklage':     'vj_kapruecklage',
  'bilanz.gesetzliche_ruecklage': 'vj_gesetzliche_ruecklage',
  'bilanz.andere_gewinnruecklagen': 'vj_andere_gewinnrueckl',
  'bilanz.bilanzgewinn':     'vj_bilanzgewinn',
  // Passiva – Rückstellungen (Anhang B.5)
  'bilanz.pensionsrueckstellungen': 'vj_pensionsrueck',
  'bilanz.steuerrueckstellungen':   'vj_steuerrueck',
  'bilanz.sonstige_rueckstellungen': 'vj_sonstige_rueck',
  // Passiva – Verbindlichkeiten
  'bilanz.anleihen':         'vj_anleihen',
  'bilanz.verbindlichkeiten_kreditinstitute': 'vj_verb_kreditinst',
  'bilanz.erhaltene_anzahlungen': 'vj_erh_anzahlungen',
  'bilanz.verbindlichkeiten_llg': 'vj_verb_llg',
  'bilanz.verbindlichkeiten_vbu': 'vj_verb_vbu',
  'bilanz.sonstige_verbindlichkeiten': 'vj_sonst_verb',
  'bilanz.passiver_rao':     'vj_passiver_rao',
};

// ── VJ-Mapping GuV → kennzahlen ──────────────────────────────────────────────
interface GuvVjMapping { field: string; acc?: boolean }
const GUV_VJ_MAP: Record<string, GuvVjMapping> = {
  umsatzerloese:    { field: 'vorjahr_umsatz' },
  sonstige_ertraege:{ field: 'vj_sonstige_ertraege' },
  material_roh:     { field: 'vj_material_roh' },
  material_dienst:  { field: 'vj_material_dienst' },
  loehne:           { field: 'vj_personalaufwand', acc: true },
  sozialabgaben:    { field: 'vj_personalaufwand', acc: true },
  abschreibungen:   { field: 'vj_abschreibungen' },
  zinsaufwendungen: { field: 'vj_zinsaufwand' },
};

// ── Bilanz VJ Summenzeilen (0-basierte Zeilenindizes, Spalte D = index 3) ────
const BILANZ_SUMMEN: Record<number, string> = {
  8:  'vj_immat_vw',
  15: 'vj_sachanlagen',
  21: 'vj_finanzanlagen',
  23: 'vj_anlagevermoegen',
  31: 'vj_vorraete',
  37: 'vj_forderungen',
  41: 'vj_umlaufvermoegen',
  46: 'vj_bilanzsumme',
  56: 'vj_eigenkapital',
  62: 'vj_rueckstellungen',
  71: 'vj_verbindlichkeiten',
};

// ── GuV VJ Zeilenindex-Map (Spalte D = index 3) ──────────────────────────────
const GUV_SUMMEN: Record<string, number> = {
  vorjahr_umsatz:      3,
  vj_sonstige_ertraege:6,
  vj_materialaufwand: 12,
  vj_loehne:          15,
  vj_sozialabgaben:   16,
  vj_personalaufwand: 17,
  vj_abschreibungen:  20,
  vj_sonstige_aufwend:21,
  vorjahr_ebitda:     23,
  vorjahr_ebit:       24,
  vj_zinsaufwand:     30,
  vorjahr_jahresueber:39,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function cellVal(ws: XLSX.WorkSheet, r: number, c: number): number | string | null {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr] as XLSX.CellObject | undefined;
  if (!cell) return null;
  const v = cell.v;
  if (v === undefined || v === null || v === '') return null;
  return v as number | string;
}

function getComment(cell: XLSX.CellObject): string {
  if (!cell.c) return '';
  if (Array.isArray(cell.c)) return (cell.c[0]?.t ?? '').trim();
  return String(cell.c).trim();
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function importExcelClient(file: File): Promise<JahresabschlussData> {
  const arrayBuffer = await file.arrayBuffer();
  return importExcelArrayBuffer(arrayBuffer);
}

export function importExcelArrayBuffer(arrayBuffer: ArrayBuffer): JahresabschlussData {
  const bytes = new Uint8Array(arrayBuffer);
  if (!bytes || bytes.length < 4) {
    throw new Error('Excel-Datei konnte nicht importiert werden.');
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    throw new Error('Excel-Datei konnte nicht importiert werden.');
  }

  const wb = XLSX.read(arrayBuffer, {
    type: 'array',
    cellText: false,
    cellDates: false,
    cellNF: false,
    cellFormula: true,
    cellComments: true,
    // cellComments is valid at runtime but not in @types/xlsx 0.18
  } as XLSX.ParsingOptions & { cellComments?: boolean });

  const rawResult: {
    stammdaten: AnyObject;
    segmente: AnyObject[];
    guv: AnyObject;
    bilanz: AnyObject;
    kennzahlen: AnyObject;
    organe: { vorstand: AnyObject[]; aufsichtsrat: AnyObject[] };
    beteiligungen: AnyObject[];
  } = {
    stammdaten:    {},
    segmente:      [],
    guv:           {},
    bilanz:        {},
    kennzahlen:    {},
    organe:        { vorstand: [], aufsichtsrat: [] },
    beteiligungen: [],
  };

  // ── Scan all comment-cells ────────────────────────────────────────
  const allMapped: Record<string, unknown> = {};
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr] as XLSX.CellObject | undefined;
        if (!cell?.c) continue;
        const key = getComment(cell);
        if (!key || !key.includes('.')) continue;

        // Type A (label + value right) vs Type B (value in same cell)
        const nextAddr = XLSX.utils.encode_cell({ r: R, c: C + 1 });
        const nextCell = ws[nextAddr] as XLSX.CellObject | undefined;
        const isTypeB = !!(nextCell?.c);
        let val: unknown;
        if (isTypeB) {
          val = cell.v;
        } else {
          const nv = cellVal(ws, R, C + 1);
          val = (nv !== null && nv !== 0) ? nv : cell.v;
        }
        if (val === undefined || val === null || val === '' || val === 0 || val === '0') continue;
        allMapped[key] = val;
      }
    }
  }

  // ── Stammdaten ────────────────────────────────────────────────────
  for (const [k, v] of Object.entries(allMapped)) {
    if (!k.startsWith('stammdaten.')) continue;
    const field = k.slice(11);
    if (field === 'anzahl_aktien') {
      rawResult.stammdaten[field] = Math.round(Number(v)) || 0;
    } else if (field === 'geschaeftsjahr' || field === 'gruendungsjahr') {
      rawResult.stammdaten[field] = String(Math.round(Number(v)));
    } else {
      rawResult.stammdaten[field] = typeof v === 'number' ? String(Math.round(v)) : String(v);
    }
  }

  // ── Segmente ──────────────────────────────────────────────────────
  const segMap: Record<number, AnyObject> = {};
  for (const [k, v] of Object.entries(allMapped)) {
    const m = k.match(/^segmente\[(\d+)\]\.(.+)$/);
    if (!m) continue;
    const idx = parseInt(m[1]);
    const field = m[2];
    if (!segMap[idx]) segMap[idx] = { name: '', umsatz: 0, vorjahr_umsatz: 0 };
    if (field === 'name') {
      const sv = String(v).trim();
      if (sv && isNaN(Number(sv))) segMap[idx]['name'] = sv;
    } else {
      segMap[idx][field] = Number(v) || 0;
    }
  }
  const segs = Object.values(segMap).filter(s => s['name'] && String(s['name']).trim());
  rawResult.segmente = segs.length > 0 ? segs : [{ name: '', umsatz: 0, vorjahr_umsatz: 0 }];

  // ── Organe ────────────────────────────────────────────────────────
  const VORSTAND_DEFAULTS = ['Vorstandsvorsitzende/r (CEO)', 'Finanzvorstand/in (CFO)', 'CTO / COO / CPO'];
  const AR_DEFAULTS       = ['Aufsichtsratsvorsitzende/r', 'Stellv. Vorsitzende/r', 'Arbeitnehmervertreter/in'];
  const vsMap: Record<number, AnyObject> = {};
  const arMap: Record<number, AnyObject> = {};
  for (const [k, v] of Object.entries(allMapped)) {
    const sv = String(v).trim();
    const mv = k.match(/^organe\.vorstand\[(\d+)\]\.(.+)$/);
    if (mv) {
      const idx = parseInt(mv[1]);
      if (!vsMap[idx]) vsMap[idx] = { name: '', funktion: '', bestellt_bis: '' };
      if (mv[2] === 'name' && VORSTAND_DEFAULTS.includes(sv)) continue;
      vsMap[idx][mv[2]] = sv;
    }
    const ma = k.match(/^organe\.aufsichtsrat\[(\d+)\]\.(.+)$/);
    if (ma) {
      const idx = parseInt(ma[1]);
      if (!arMap[idx]) arMap[idx] = { name: '', funktion: '' };
      if (ma[2] === 'name' && AR_DEFAULTS.includes(sv)) continue;
      arMap[idx][ma[2]] = sv;
    }
  }
  rawResult.organe.vorstand     = Object.values(vsMap).filter(v => v['name']);
  rawResult.organe.aufsichtsrat = Object.values(arMap).filter(a => a['name']);
  if (!rawResult.organe.vorstand.length)
    rawResult.organe.vorstand = [{ name: '', funktion: 'Vorstandsvorsitzende/r (CEO)', bestellt_bis: '' }];

  // ── GuV (aktuelle Werte) ──────────────────────────────────────────
  for (const [k, v] of Object.entries(allMapped)) {
    if (!k.startsWith('guv.')) continue;
    rawResult.guv[k.slice(4)] = Number(v) || 0;
  }

  // ── GuV Vorjahreswerte aus Spalte D ──────────────────────────────
  const wsGuvName = wb.SheetNames.find(n => n.includes('GuV'));
  if (wsGuvName) {
    const wsGuv = wb.Sheets[wsGuvName];
    const guvRange = XLSX.utils.decode_range(wsGuv['!ref']!);
    for (let R = guvRange.s.r; R <= guvRange.e.r; R++) {
      for (let C = guvRange.s.c; C <= guvRange.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = wsGuv[addr] as XLSX.CellObject | undefined;
        if (!cell?.c) continue;
        const key = getComment(cell);
        if (!key.startsWith('guv.')) continue;
        const mapping = GUV_VJ_MAP[key.slice(4)];
        if (!mapping) continue;
        const vjVal = cellVal(wsGuv, R, C + 2);
        if (vjVal !== null && vjVal !== 0) {
          if (mapping.acc) {
            rawResult.kennzahlen[mapping.field] = ((rawResult.kennzahlen[mapping.field] as number) || 0) + (Number(vjVal) || 0);
          } else {
            rawResult.kennzahlen[mapping.field] = Number(vjVal) || 0;
          }
        }
      }
    }
    for (const [kk, rowIdx] of Object.entries(GUV_SUMMEN)) {
      const v = cellVal(wsGuv, rowIdx, 3);
      if (v !== null && v !== 0) rawResult.kennzahlen[kk] = Number(v) || 0;
    }
    // vj_loehne and vj_sozialabgaben are already in GUV_SUMMEN
  }

  // ── Bilanz (aktuelle Werte) ───────────────────────────────────────
  for (const [k, v] of Object.entries(allMapped)) {
    if (!k.startsWith('bilanz.')) continue;
    rawResult.bilanz[k.slice(7)] = Number(v) || 0;
  }

  // ── Bilanz VJ – Kommentar-basiert (CURRENT_TO_VJ) ─────────────────
  const wsBilanzName = wb.SheetNames.find(n => n.includes('Bilanz') || n.includes('bilanz'));
  if (wsBilanzName) {
    const wsBilanz = wb.Sheets[wsBilanzName];
    const bilanzRange = XLSX.utils.decode_range(wsBilanz['!ref']!);
    for (let R = bilanzRange.s.r; R <= bilanzRange.e.r; R++) {
      for (let C = bilanzRange.s.c; C <= bilanzRange.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = wsBilanz[addr] as XLSX.CellObject | undefined;
        if (!cell?.c) continue;
        const key = getComment(cell);
        const vjKey = CURRENT_TO_VJ[key];
        if (!vjKey) continue;
        const vjVal = cellVal(wsBilanz, R, C + 2);
        if (vjVal !== null && vjVal !== 0) rawResult.bilanz[vjKey] = Number(vjVal) || 0;
      }
    }

    // ── Bilanz VJ – Summenzeilen (feste Zeilen) ────────────────────
    for (const [rowIdxStr, vjKey] of Object.entries(BILANZ_SUMMEN)) {
      const v = cellVal(wsBilanz, Number(rowIdxStr), 3);
      if (v !== null && v !== 0) rawResult.bilanz[vjKey] = Number(v) || 0;
    }

    // ── Gewinnrücklagen VJ aus Sub-Items berechnen ─────────────────
    const gesRueckl = (rawResult.bilanz['vj_gesetzliche_ruecklage'] as number) || 0;
    const andRueckl = (rawResult.bilanz['vj_andere_gewinnrueckl'] as number) || 0;
    if (gesRueckl || andRueckl) rawResult.bilanz['vj_gewinnruecklagen'] = gesRueckl + andRueckl;
  }

  // ── Bilanz: aktuelle Summen berechnen ─────────────────────────────
  const B = rawResult.bilanz;
  B['immat_vw']            = ((B['immat_lizenzen'] as number)||0) + ((B['immat_selbst'] as number)||0) + ((B['immat_anzahlungen'] as number)||0);
  B['sachanlagen']         = ((B['sach_gebaeude'] as number)||0) + ((B['sach_maschinen'] as number)||0) + ((B['sach_ausstattung'] as number)||0) + ((B['sach_anbau'] as number)||0);
  B['finanzanlagen']       = ((B['fin_anteilsvbu'] as number)||0) + ((B['fin_ausleihvbu'] as number)||0) + ((B['fin_beteiligungen'] as number)||0);
  B['vorraete']            = ((B['vorr_rhb'] as number)||0) + ((B['vorr_unfertig'] as number)||0) + ((B['vorr_fertig'] as number)||0) + ((B['vorr_anzahlungen'] as number)||0);
  B['forderungen_gesamt']  = ((B['ford_llg'] as number)||0) + ((B['ford_vbu'] as number)||0) + ((B['ford_sonstige'] as number)||0);
  B['eigenkapital_gesamt'] = ((B['gezeichnetes_kapital'] as number)||0) + ((B['kapitalruecklage'] as number)||0) + ((B['gesetzliche_ruecklage'] as number)||0) + ((B['andere_gewinnruecklagen'] as number)||0) + ((B['bilanzgewinn'] as number)||0);
  B['bilanzsumme']         = (B['immat_vw'] as number) + (B['sachanlagen'] as number) + (B['finanzanlagen'] as number) + (B['vorraete'] as number) + (B['forderungen_gesamt'] as number) + ((B['wertpapiere_umlauf'] as number)||0) + ((B['liquide_mittel'] as number)||0) + ((B['aktiver_rao'] as number)||0) + ((B['aktive_latente_steuern'] as number)||0);

  // ── Kennzahlen (Vorlage-Sheet) ────────────────────────────────────
  for (const [k, v] of Object.entries(allMapped)) {
    if (!k.startsWith('kennzahlen.')) continue;
    rawResult.kennzahlen[k.slice(11)] = Number(v) || 0;
  }

  console.log('Excel-Import erfolgreich:', {
    stammdaten:  `${Object.keys(rawResult.stammdaten).length} Felder`,
    segmente:    `${rawResult.segmente.length} Segmente`,
    guv:         `${Object.keys(rawResult.guv).length} Felder`,
    bilanz:      `${Object.keys(rawResult.bilanz).length} Felder (inkl. VJ)`,
    kennzahlen:  `${Object.keys(rawResult.kennzahlen).length} Felder (inkl. VJ)`,
    vorstand:    rawResult.organe.vorstand.length,
    aufsichtsrat:rawResult.organe.aufsichtsrat.length,
  });

  return rawResult as unknown as JahresabschlussData;
}
