/**
 * Excel Import Service  (v13)
 *
 * Kommentar-Zellen-Typen in der Vorlage:
 *  A) Label-Zelle (Spalte B): Kommentar auf B, aktueller Wert auf C, VJ-Wert auf D
 *     → GuV, Bilanz-Einzelpositionen, Stammdaten
 *  B) Wert-Zelle: Kommentar und Wert auf derselben Zelle (Segmente, Organe)
 *
 * Unterscheidung: Wenn C+1 einen eigenen Kommentar hat → Typ B
 *                 Sonst                                → Typ A
 *
 * VJ-Werte Bilanz: Spalte D, über feste Zeilen-Maps (Kommentare + Summenzeilen)
 * VJ-Werte GuV:    Spalte D, über feste Zeilen-Map
 */

let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  throw new Error(
    'Das Paket "xlsx" ist nicht installiert. Bitte im backend-Ordner ausführen: npm install\n' +
    'Original-Fehler: ' + e.message
  );
}

function importExcel(buffer) {
  // Basis-Validierung: muss mindestens ein ZIP/XLSX-Header haben
  if (!buffer || buffer.length < 4) {
    throw new Error('Ungültige Datei: Buffer zu klein oder leer');
  }
  // XLSX ist ein ZIP-Container — Magic Bytes: 50 4B 03 04
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
    throw new Error('Ungültige Datei: Kein gültiges XLSX-Format (kein ZIP/PK-Header)');
  }

  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellText: false,
    cellDates: false,
    cellNF: false,
    cellComments: true,
    cellFormula: true,
  });

  const result = {
    stammdaten:    {},
    segmente:      [],
    guv:           {},
    bilanz:        {},
    kennzahlen:    {},
    organe:        { vorstand: [], aufsichtsrat: [] },
    beteiligungen: [],
  };

  // ── Hilfsfunktionen ───────────────────────────────────────────────
  function cellVal(ws, r, c) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    if (!cell) return null;
    const v = cell.v;
    if (v === undefined || v === null || v === '') return null;
    return v;
  }

  function cellHasComment(ws, r, c) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    return !!(cell && cell.c);
  }

  // ── Alle Kommentar-Zellen durchlesen ─────────────────────────────
  const allMapped = {};

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']);

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell || !cell.c) continue;

        const key = Array.isArray(cell.c)
          ? (cell.c[0]?.t || '').trim()
          : String(cell.c).trim();
        if (!key || !key.includes('.')) continue;

        let val;
        if (cellHasComment(ws, R, C + 1)) {
          // Typ B: Wert direkt in der Kommentar-Zelle (Segmente, Organe)
          val = cell.v;
        } else {
          // Typ A: Wert in der Spalte rechts (Eingabe-Spalte)
          const nextVal = cellVal(ws, R, C + 1);
          val = (nextVal !== null && nextVal !== 0) ? nextVal : cell.v;
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
      result.stammdaten[field] = Math.round(Number(v)) || 0;
    } else if (field === 'geschaeftsjahr' || field === 'gruendungsjahr') {
      result.stammdaten[field] = String(Math.round(Number(v)));
    } else {
      result.stammdaten[field] = typeof v === 'number' ? String(Math.round(v)) : String(v);
    }
  }

  // ── Segmente ──────────────────────────────────────────────────────
  const segMap = {};
  for (const [k, v] of Object.entries(allMapped)) {
    const m = k.match(/^segmente\[(\d+)\]\.(.+)$/);
    if (!m) continue;
    const idx   = parseInt(m[1]);
    const field = m[2];
    if (!segMap[idx]) segMap[idx] = { name: '', umsatz: 0, vorjahr_umsatz: 0 };
    if (field === 'name') {
      const sv = String(v).trim();
      if (sv && isNaN(sv)) segMap[idx].name = sv;
    } else {
      segMap[idx][field] = Number(v) || 0;
    }
  }
  const segs = Object.values(segMap).filter(s => s.name && s.name.trim());
  result.segmente = segs.length > 0 ? segs : [{ name: '', umsatz: 0, vorjahr_umsatz: 0 }];

  // ── Organe ────────────────────────────────────────────────────────
  const VORSTAND_DEFAULTS = ['Vorstandsvorsitzende/r (CEO)', 'Finanzvorstand/in (CFO)', 'CTO / COO / CPO'];
  const AR_DEFAULTS       = ['Aufsichtsratsvorsitzende/r', 'Stellv. Vorsitzende/r', 'Arbeitnehmervertreter/in'];
  const vsMap = {}, arMap = {};
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
  result.organe.vorstand     = Object.values(vsMap).filter(v => v.name);
  result.organe.aufsichtsrat = Object.values(arMap).filter(a => a.name);
  if (!result.organe.vorstand.length)
    result.organe.vorstand = [{ name: '', funktion: 'Vorstandsvorsitzende/r (CEO)', bestellt_bis: '' }];

  // ── GuV (aktuelle Werte) ──────────────────────────────────────────
  for (const [k, v] of Object.entries(allMapped)) {
    if (!k.startsWith('guv.')) continue;
    result.guv[k.slice(4)] = Number(v) || 0;
  }

  // ── GuV Vorjahreswerte aus Spalte D (Zeilen 0-basiert) ───────────
  const wsGuvName = wb.SheetNames.find(n => n.includes('GuV'));
  if (wsGuvName) {
    const wsGuv = wb.Sheets[wsGuvName];
    const GUV_VJ = {                // Zeile (0-basiert) → kennzahlen-Key
      vorjahr_umsatz:        3,     // D4
      vj_sonstige_ertraege:  6,     // D7
      vj_materialaufwand:   12,     // D13 (Summe)
      vj_loehne:            15,     // D16
      vj_sozialabgaben:     16,     // D17
      vj_personalaufwand:   17,     // D18 (Summe)
      vj_abschreibungen:    20,     // D21
      vj_sonstige_aufwend:  21,     // D22
      vorjahr_ebitda:       23,     // D24
      vorjahr_ebit:         24,     // D25
      vj_zinsaufwand:       30,     // D31
      vorjahr_jahresueber:  39,     // D40
    };
    for (const [kk, rowIdx] of Object.entries(GUV_VJ)) {
      const v = cellVal(wsGuv, rowIdx, 3); // Spalte D = col-index 3
      if (v !== null && v !== 0) result.kennzahlen[kk] = Number(v) || 0;
    }
  }

  // ── Bilanz (aktuelle Werte) ───────────────────────────────────────
  for (const [k, v] of Object.entries(allMapped)) {
    if (!k.startsWith('bilanz.')) continue;
    result.bilanz[k.slice(7)] = Number(v) || 0;
  }

  // ── Bilanz Vorjahreswerte aus Spalte D ────────────────────────────
  const wsBilanzName = wb.SheetNames.find(n => n.includes('Bilanz') || n.includes('bilanz'));
  if (wsBilanzName) {
    const wsBilanz = wb.Sheets[wsBilanzName];
    const B = result.bilanz;

    // Einzelpositionen mit Kommentar → VJ aus Spalte D
    // Kommentar-Key (aktueller Feldname) → vj_key im result.bilanz
    const CURRENT_TO_VJ = {
      // Aktiva – Immat. Vermögenswerte (für Anhang-Anlagenspiegel)
      'bilanz.immat_lizenzen':                  'vj_immat_lizenzen',
      'bilanz.immat_selbst':                    'vj_immat_selbst',
      'bilanz.immat_anzahlungen':               'vj_immat_anzahlungen',
      // Aktiva – Sachanlagen
      'bilanz.sach_gebaeude':                   'vj_sach_gebaeude',
      'bilanz.sach_maschinen':                  'vj_sach_maschinen',
      'bilanz.sach_ausstattung':                'vj_sach_ausstattung',
      'bilanz.sach_anbau':                      'vj_sach_anbau',
      // Aktiva – Finanzanlagen
      'bilanz.fin_anteilsvbu':                  'vj_fin_anteilsvbu',
      'bilanz.fin_ausleihvbu':                  'vj_fin_ausleihvbu',
      'bilanz.fin_beteiligungen':               'vj_fin_beteiligungen',
      // Aktiva – Vorräte (Anhang B.2)
      'bilanz.vorr_rhb':                        'vj_vorr_rhb',
      'bilanz.vorr_unfertig':                   'vj_vorr_unfertig',
      'bilanz.vorr_fertig':                     'vj_vorr_fertig',
      'bilanz.vorr_anzahlungen':                'vj_vorr_anzahlungen',
      // Aktiva – Forderungen
      'bilanz.ford_llg':                        'vj_ford_llg',
      'bilanz.ford_vbu':                        'vj_ford_vbu',
      'bilanz.ford_sonstige':                   'vj_ford_sonstige',
      // Aktiva – Sonstiges
      'bilanz.wertpapiere_umlauf':              'vj_wertpapiere',
      'bilanz.liquide_mittel':                  'vj_liquide_mittel',
      'bilanz.aktiver_rao':                     'vj_aktiver_rao',
      'bilanz.aktive_latente_steuern':          'vj_aktive_latente',
      // Passiva – Eigenkapital (Anhang B.4)
      'bilanz.gezeichnetes_kapital':            'vj_ez_kapital',
      'bilanz.kapitalruecklage':                'vj_kapruecklage',
      'bilanz.gesetzliche_ruecklage':           'vj_gesetzliche_ruecklage',
      'bilanz.andere_gewinnruecklagen':         'vj_andere_gewinnrueckl',
      'bilanz.bilanzgewinn':                    'vj_bilanzgewinn',
      // Passiva – Rückstellungen (Anhang B.5)
      'bilanz.pensionsrueckstellungen':         'vj_pensionsrueck',
      'bilanz.steuerrueckstellungen':           'vj_steuerrueck',
      'bilanz.sonstige_rueckstellungen':        'vj_sonstige_rueck',
      // Passiva – Verbindlichkeiten
      'bilanz.anleihen':                        'vj_anleihen',
      'bilanz.verbindlichkeiten_kreditinstitute': 'vj_verb_kreditinst',
      'bilanz.erhaltene_anzahlungen':           'vj_erh_anzahlungen',
      'bilanz.verbindlichkeiten_llg':           'vj_verb_llg',
      'bilanz.verbindlichkeiten_vbu':           'vj_verb_vbu',
      'bilanz.sonstige_verbindlichkeiten':      'vj_sonst_verb',
      'bilanz.passiver_rao':                    'vj_passiver_rao',
    };

    const bilanzRange = XLSX.utils.decode_range(wsBilanz['!ref']);
    for (let R = bilanzRange.s.r; R <= bilanzRange.e.r; R++) {
      for (let C = bilanzRange.s.c; C <= bilanzRange.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = wsBilanz[addr];
        if (!cell || !cell.c) continue;
        const key = Array.isArray(cell.c)
          ? (cell.c[0]?.t || '').trim()
          : String(cell.c).trim();
        const vjKey = CURRENT_TO_VJ[key];
        if (!vjKey) continue;
        const vjVal = cellVal(wsBilanz, R, C + 2); // Kommentar auf B(idx C), Wert auf C(C+1), VJ auf D(C+2)
        if (vjVal !== null && vjVal !== 0) B[vjKey] = Number(vjVal) || 0;
      }
    }

    // Summenzeilen (keine Kommentare) → feste Zeilen-Map (0-basiert)
    const BILANZ_SUMMEN = {
      8:  'vj_immat_vw',         // Zeile 9
      15: 'vj_sachanlagen',      // Zeile 16
      21: 'vj_finanzanlagen',    // Zeile 22
      23: 'vj_anlagevermoegen',  // Zeile 24
      31: 'vj_vorraete',         // Zeile 32
      37: 'vj_forderungen',      // Zeile 38
      41: 'vj_umlaufvermoegen',  // Zeile 42
      46: 'vj_bilanzsumme',      // Zeile 47
      56: 'vj_eigenkapital',     // Zeile 57
      62: 'vj_rueckstellungen',  // Zeile 63
      71: 'vj_verbindlichkeiten',// Zeile 72
    };
    for (const [rowIdx, vjKey] of Object.entries(BILANZ_SUMMEN)) {
      const v = cellVal(wsBilanz, Number(rowIdx), 3); // Spalte D = col-index 3
      if (v !== null && v !== 0) B[vjKey] = Number(v) || 0;
    }

    // Gewinnrücklagen VJ: aus den bereits gemappten Einzelpositionen berechnen
    if (B.vj_gesetzliche_ruecklage || B.vj_andere_gewinnrueckl) {
      B.vj_gewinnruecklagen = (B.vj_gesetzliche_ruecklage || 0) + (B.vj_andere_gewinnrueckl || 0);
    }
  }

  // ── Bilanz: Summen für aktuelle Werte berechnen ───────────────────
  const B = result.bilanz;
  B.immat_vw            = (B.immat_lizenzen||0) + (B.immat_selbst||0) + (B.immat_anzahlungen||0);
  B.sachanlagen         = (B.sach_gebaeude||0)  + (B.sach_maschinen||0) + (B.sach_ausstattung||0) + (B.sach_anbau||0);
  B.finanzanlagen       = (B.fin_anteilsvbu||0) + (B.fin_ausleihvbu||0) + (B.fin_beteiligungen||0);
  B.vorraete            = (B.vorr_rhb||0) + (B.vorr_unfertig||0) + (B.vorr_fertig||0) + (B.vorr_anzahlungen||0);
  B.forderungen_gesamt  = (B.ford_llg||0) + (B.ford_vbu||0) + (B.ford_sonstige||0);
  B.eigenkapital_gesamt = (B.gezeichnetes_kapital||0) + (B.kapitalruecklage||0) +
                          (B.gesetzliche_ruecklage||0) + (B.andere_gewinnruecklagen||0) + (B.bilanzgewinn||0);
  B.bilanzsumme         = B.immat_vw + B.sachanlagen + B.finanzanlagen +
                          B.vorraete + B.forderungen_gesamt +
                          (B.wertpapiere_umlauf||0) + (B.liquide_mittel||0) +
                          (B.aktiver_rao||0) + (B.aktive_latente_steuern||0);

  // ── Kennzahlen ────────────────────────────────────────────────────
  for (const [k, v] of Object.entries(allMapped)) {
    if (!k.startsWith('kennzahlen.')) continue;
    result.kennzahlen[k.slice(11)] = Number(v) || 0;
  }

  console.log('Excel-Import erfolgreich:', {
    stammdaten:  Object.keys(result.stammdaten).length + ' Felder',
    segmente:    result.segmente.length + ' Segmente',
    guv:         Object.keys(result.guv).length + ' Felder',
    bilanz:      Object.keys(result.bilanz).length + ' Felder (inkl. VJ)',
    kennzahlen:  Object.keys(result.kennzahlen).length + ' Felder (inkl. VJ)',
    vorstand:    result.organe.vorstand.length,
    aufsichtsrat:result.organe.aufsichtsrat.length,
  });

  return result;
}

module.exports = { importExcel };
