const { Document, Packer, PageBreak, Paragraph, TextRun, BorderStyle } = require('docx');
const {
  sp, divider, h1, h2, h3, para, note,
  titlePage, makeHeader, makeFooter, signatureBlock,
  bilanzTable, dataTable, C, fmt, fmtT, fmtPct,
} = require('../utils/docxHelpers');

// ── Format TEUR value for bilanz tables ────────────────────────────
function t(n) {
  if (n == null || n === "" || n === 0) return "";
  const abs = Math.abs(Number(n));
  const neg = Number(n) < 0;
  return (neg ? "-" : "") + abs.toLocaleString('de-DE') + "";
}

// VJ-Spalte: blank wenn nicht eingegeben (0/undefined), sonst Wert
function vj(n) {
  if (!n || Number(n) === 0) return "";
  return t(n);
}

function fieldNumber(source, ...names) {
  for (const name of names) {
    const value = source[name];
    if (typeof value === 'number') return value;
  }
  return undefined;
}

async function renderBilanzGuV(data, texts) {
  const { stammdaten, bilanz, guv, organe, kennzahlen } = data;
  const year    = stammdaten.geschaeftsjahr;
  const company = stammdaten.firmenname;

  // ── Derive values ─────────────────────────────────────────────
  const B = bilanz;
  const G = guv;

  // Helper: prior year suffix
  const py = kennzahlen.vorjahr_suffix || String(parseInt(year) - 1);

  // Computed subtotals (the renderer trusts the user's input; totals are passed in or computed)
  const anlageSumme   = (B.immat_vw || 0) + (B.sachanlagen || 0) + (B.finanzanlagen || 0);
  const umlaufSumme   = (B.vorraete || 0) + (B.forderungen_gesamt || 0) + (B.wertpapiere_umlauf || 0) + (B.liquide_mittel || 0);
  const aktivSumme    = anlageSumme + umlaufSumme + (B.aktiver_rao || 0) + (B.aktive_latente_steuern || 0);

  const gezeichKap    = B.gezeichnetes_kapital || 0;
  const kapRueckl     = B.kapitalruecklage || 0;
  const gewinnRueckl  = (B.gesetzliche_ruecklage || 0) + (B.andere_gewinnruecklagen || 0);
  const bilanzgewinn  = B.bilanzgewinn || 0;
  const ekSumme       = gezeichKap + kapRueckl + gewinnRueckl + bilanzgewinn + (B.sonderposten || 0);
  const rueckstSumme  = (B.pensionsrueckstellungen || 0) + (B.steuerrueckstellungen || 0) + (B.sonstige_rueckstellungen || 0);
  const verbSumme     = (B.anleihen || 0) + (B.verbindlichkeiten_kreditinstitute || 0) + (B.verbindlichkeiten_llg || 0) + (B.verbindlichkeiten_vbu || 0) + (B.sonstige_verbindlichkeiten || 0) + (B.erhaltene_anzahlungen || 0);
  const passivSumme   = ekSumme + rueckstSumme + verbSumme + (B.passiver_rao || 0);
  const vjSonstigeVerb = fieldNumber(B, 'vj_sonstige_verbindlichkeiten', 'vj_sonst_verb');
  const vjVerbSumme    = fieldNumber(B, 'vj_verbindlichkeiten');

  // GuV derived
  const gesamtleistung = (G.umsatzerloese || 0) + (G.bestandsveraenderung || 0) + (G.eigenleistungen || 0) + (G.sonstige_ertraege || 0);
  const materialSumme  = -Math.abs((G.material_roh || 0) + (G.material_dienst || 0));
  const personalSumme  = -Math.abs((G.loehne || 0) + (G.sozialabgaben || 0));
  const aufwSumme      = materialSumme + personalSumme - Math.abs(G.abschreibungen || 0) - Math.abs(G.sonstige_aufwendungen || 0);
  const ebit           = gesamtleistung + aufwSumme;
  const finanzErg      = (G.beteiligungsertraege || 0) + (G.zinsertraege || 0) - Math.abs(G.zinsaufwendungen || 0) - Math.abs(G.abschr_finanzanlagen || 0);
  const ergebnisGewoehnl = ebit + finanzErg;
  const steuerSumme    = -Math.abs((G.steuern_ertrag || 0) + (G.sonstige_steuern || 0));
  const jahresueber    = ergebnisGewoehnl + steuerSumme;

  // ── AKTIVA rows ──────────────────────────────────────────────
  const BAL = [4200, 1608, 1608, 1610];
  const PY  = kennzahlen.vorjahr_bilanzsumme || 0;

  const aktivaRows = [
    { type: 'header',    cols: ["AKTIVA", `${year} TEUR`, `${py} TEUR`, "Anhang"] },
    { type: 'group',     cols: ["A.  ANLAGEVERMOEGEN", "", "", ""] },
    { type: 'subgroup',  cols: ["I.  Immaterielle Vermögenswerte", "", "", ""] },
    { type: 'subitem',   cols: ["    Entgeltlich erw. Rechte und Lizenzen", t(B.immat_lizenzen), vj(B.vj_immat_lizenzen), "B.1"] },
    { type: 'subitem',   cols: ["    Selbst erstellte immat. Vermögenswerte", t(B.immat_selbst), vj(B.vj_immat_selbst), "B.1"] },
    { type: 'subitem',   cols: ["    Geleistete Anzahlungen", t(B.immat_anzahlungen), vj(B.vj_immat_anzahlungen), "B.1"] },
    { type: 'total',     cols: ["    Summe immat. Vermögenswerte", t(B.immat_vw), vj(B.vj_immat_vw), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'subgroup',  cols: ["II. Sachanlagen", "", "", ""] },
    { type: 'subitem',   cols: ["    Grundstücke und Gebäude", t(B.sach_gebaeude), vj(B.vj_sach_gebaeude), "B.1"] },
    { type: 'subitem',   cols: ["    Techn. Anlagen und Maschinen", t(B.sach_maschinen), vj(B.vj_sach_maschinen), "B.1"] },
    { type: 'subitem',   cols: ["    Betriebs- und Geschäftsausstattung", t(B.sach_ausstattung), vj(B.vj_sach_ausstattung), "B.1"] },
    { type: 'subitem',   cols: ["    Anlagen im Bau / Anzahlungen", t(B.sach_anbau), vj(B.vj_sach_anbau), "B.1"] },
    { type: 'total',     cols: ["    Summe Sachanlagen", t(B.sachanlagen), vj(B.vj_sachanlagen), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'subgroup',  cols: ["III.Finanzanlagen", "", "", ""] },
    { type: 'subitem',   cols: ["    Anteile an verbundenen Unternehmen", t(B.fin_anteilsvbu), vj(B.vj_fin_anteilsvbu), "B.1"] },
    { type: 'subitem',   cols: ["    Ausleihungen an verbundene Unternehmen", t(B.fin_ausleihvbu), vj(B.vj_fin_ausleihvbu), "B.1"] },
    { type: 'subitem',   cols: ["    Beteiligungen", t(B.fin_beteiligungen), vj(B.vj_fin_beteiligungen), "B.1"] },
    { type: 'total',     cols: ["    Summe Finanzanlagen", t(B.finanzanlagen || 0), t(B.vj_finanzanlagen || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'total',     cols: ["SUMME ANLAGEVERMOEGEN", t(anlageSumme), t(B.vj_anlagevermoegen || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'group',     cols: ["B.  UMLAUFVERMOEGEN", "", "", ""] },
    { type: 'subgroup',  cols: ["I.  Vorräte", "", "", ""] },
    { type: 'subitem',   cols: ["    Roh-, Hilfs- und Betriebsstoffe", t(B.vorr_rhb), vj(B.vj_vorr_rhb), "B.2"] },
    { type: 'subitem',   cols: ["    Unfertige Erzeugnisse", t(B.vorr_unfertig), vj(B.vj_vorr_unfertig), "B.2"] },
    { type: 'subitem',   cols: ["    Fertige Erzeugnisse und Waren", t(B.vorr_fertig), vj(B.vj_vorr_fertig), "B.2"] },
    { type: 'subitem',   cols: ["    Geleistete Anzahlungen", t(B.vorr_anzahlungen), vj(B.vj_vorr_anzahlungen), "B.2"] },
    { type: 'total',     cols: ["    Summe Vorräte", t(B.vorraete || 0), t(B.vj_vorraete || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'subgroup',  cols: ["II. Forderungen und sonst. Vermögensgegenstande", "", "", ""] },
    { type: 'subitem',   cols: ["    Forderungen aus Lieferungen u. Leistungen", t(B.ford_llg), vj(B.vj_ford_llg), "B.3"] },
    { type: 'subitem',   cols: ["    Forderungen gg. verbundene Unternehmen", t(B.ford_vbu), vj(B.vj_ford_vbu), "B.3"] },
    { type: 'subitem',   cols: ["    Sonstige Vermögensgegenstande", t(B.ford_sonstige), vj(B.vj_ford_sonstige), "B.3"] },
    { type: 'total',     cols: ["    Summe Forderungen", t(B.forderungen_gesamt || 0), t(B.vj_forderungen || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'subgroup',  cols: ["III.Wertpapiere des Umlaufvermogens", "", "", ""] },
    { type: 'subitem',   cols: ["    Sonstige Wertpapiere", t(B.wertpapiere_umlauf), vj(B.vj_wertpapiere), ""] },
    { type: 'total',     cols: ["    Summe Wertpapiere", t(B.wertpapiere_umlauf || 0), t(B.vj_wertpapiere || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'subgroup',  cols: ["IV. Kassenbestand und Bankguthaben", "", "", ""] },
    { type: 'subitem',   cols: ["    Liquide Mittel", t(B.liquide_mittel), vj(B.vj_liquide_mittel), ""] },
    { type: 'total',     cols: ["    Summe liquide Mittel", t(B.liquide_mittel || 0), t(B.vj_liquide_mittel || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'total',     cols: ["SUMME UMLAUFVERMOEGEN", t(umlaufSumme), t(B.vj_umlaufvermoegen || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'group',     cols: ["C.  RECHNUNGSABGRENZUNGSPOSTEN", "", "", ""] },
    { type: 'item',      cols: ["    Aktive RAP", t(B.aktiver_rao || 0), t(B.vj_aktiver_rao || 0), ""] },
    { type: 'group',     cols: ["D.  AKTIVE LATENTE STEUERN", "", "", ""] },
    { type: 'item',      cols: ["    Aktive latente Steuern (§ 274 HGB)", t(B.aktive_latente_steuern || 0), t(B.vj_aktive_latente || 0), "B.7"] },
    { type: 'spacer',    cols: [] },
    { type: 'grandtotal', cols: ["BILANZSUMME AKTIVA", t(aktivSumme), t(B.vj_bilanzsumme || 0), ""] },
  ];

  // ── PASSIVA rows ──────────────────────────────────────────────
  const passivaRows = [
    { type: 'header',    cols: ["PASSIVA", `${year} TEUR`, `${py} TEUR`, "Anhang"] },
    { type: 'group',     cols: ["A.  EIGENKAPITAL", "", "", ""] },
    { type: 'item',      cols: ["I.  Gezeichnetes Kapital", t(gezeichKap), t(B.vj_ez_kapital || 0), "B.4"] },
    { type: 'item',      cols: ["II. Kapitalrücklage", t(kapRueckl), t(B.vj_kapruecklage || 0), "B.4"] },
    { type: 'subgroup',  cols: ["III.Gewinnrücklagen", "", "", ""] },
    { type: 'subitem',   cols: ["    Gesetzliche Rücklage", t(B.gesetzliche_ruecklage), vj(B.vj_gesetzliche_ruecklage), "B.4"] },
    { type: 'subitem',   cols: ["    Andere Gewinnrücklagen", t(B.andere_gewinnruecklagen), vj(B.vj_andere_gewinnrueckl), "B.4"] },
    { type: 'total',     cols: ["    Summe Gewinnrücklagen", t(gewinnRueckl), t(B.vj_gewinnruecklagen || 0), ""] },
    { type: 'item',      cols: ["IV. Bilanzgewinn", t(bilanzgewinn), t(B.vj_bilanzgewinn || 0), "B.4"] },
    { type: 'total',     cols: ["SUMME EIGENKAPITAL", t(gezeichKap + kapRueckl + gewinnRueckl + bilanzgewinn), t(B.vj_eigenkapital || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'group',     cols: ["B.  RUECKSTELLUNGEN", "", "", ""] },
    { type: 'item',      cols: ["1.  Pensionsrückstellungen", t(B.pensionsrueckstellungen || 0), t(B.vj_pensionsrueck || 0), "B.5"] },
    { type: 'item',      cols: ["2.  Steuerrückstellungen", t(B.steuerrueckstellungen || 0), t(B.vj_steuerrueck || 0), "B.5"] },
    { type: 'item',      cols: ["3.  Sonstige Rückstellungen", t(B.sonstige_rueckstellungen || 0), t(B.vj_sonstige_rueck || 0), "B.5"] },
    { type: 'total',     cols: ["SUMME RUECKSTELLUNGEN", t(rueckstSumme), t(B.vj_rueckstellungen || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'group',     cols: ["C.  VERBINDLICHKEITEN", "", "", ""] },
    { type: 'item',      cols: ["1.  Anleihen", t(B.anleihen || 0), t(B.vj_anleihen || 0), "B.6"] },
    { type: 'item',      cols: ["2.  Verbindlichkeiten gg. Kreditinstitute", t(B.verbindlichkeiten_kreditinstitute || 0), t(B.vj_verb_kreditinst || 0), "B.6"] },
    { type: 'item',      cols: ["3.  Erhaltene Anzahlungen", t(B.erhaltene_anzahlungen || 0), t(B.vj_erh_anzahlungen || 0), "B.6"] },
    { type: 'item',      cols: ["4.  Verbindlichkeiten aus L. u. L.", t(B.verbindlichkeiten_llg || 0), t(B.vj_verb_llg || 0), "B.6"] },
    { type: 'item',      cols: ["5.  Verbindlichkeiten gg. verbundene Unternehmen", t(B.verbindlichkeiten_vbu || 0), t(B.vj_verb_vbu || 0), "B.6"] },
    { type: 'item',      cols: ["6.  Sonstige Verbindlichkeiten", t(B.sonstige_verbindlichkeiten || 0), vj(vjSonstigeVerb == null ? undefined : Math.round(vjSonstigeVerb)), "B.6"] },
    { type: 'total',     cols: ["SUMME VERBINDLICHKEITEN", t(verbSumme), vj(vjVerbSumme == null ? undefined : Math.round(vjVerbSumme)), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'group',     cols: ["D.  RECHNUNGSABGRENZUNGSPOSTEN", "", "", ""] },
    { type: 'item',      cols: ["    Passive RAP", t(B.passiver_rao || 0), t(B.vj_passiver_rao || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'grandtotal', cols: ["BILANZSUMME PASSIVA", t(passivSumme), t(B.vj_bilanzsumme || 0), ""] },
  ];

  // ── GuV rows ──────────────────────────────────────────────────
  const GUV_COLS = [4700, 1513, 1513, 1300];
  const guvRows = [
    { type: 'header',    cols: ["POSITION", `GJ ${year} TEUR`, `GJ ${py} TEUR`, "Anhang"] },
    { type: 'group',     cols: ["ERLOESE UND SONSTIGE ERTRAEGE", "", "", ""] },
    { type: 'item',      cols: ["1.  Umsatzerlöse", t(G.umsatzerloese || 0), t(kennzahlen.vorjahr_umsatz || 0), "C.1"] },
    { type: 'item',      cols: ["2.  Bestandsveränderung", t(G.bestandsveraenderung || 0), "", ""] },
    { type: 'item',      cols: ["3.  Andere aktivierte Eigenleistungen", t(G.eigenleistungen || 0), "", ""] },
    { type: 'item',      cols: ["4.  Sonstige betriebliche Erträge", t(G.sonstige_ertraege || 0), t(kennzahlen.vj_sonstige_ertraege || 0), "C.2"] },
    { type: 'total',     cols: ["GESAMTLEISTUNG", t(gesamtleistung), "", ""] },
    { type: 'spacer',    cols: [] },
    { type: 'group',     cols: ["BETRIEBLICHE AUFWENDUNGEN", "", "", ""] },
    { type: 'item',      cols: ["5.  Materialaufwand", "", "", ""] },
    { type: 'subitem',   cols: ["    a) Roh-, Hilfs- u. Betriebsstoffe, bezogene Waren", t(-(G.material_roh || 0)), "", ""] },
    { type: 'subitem',   cols: ["    b) Bezogene Leistungen", t(-(G.material_dienst || 0)), "", ""] },
    { type: 'total',     cols: ["    Summe Materialaufwand", t(materialSumme), t(-(kennzahlen.vj_materialaufwand || 0)), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'item',      cols: ["6.  Personalaufwand", "", "", ""] },
    { type: 'subitem',   cols: ["    a) Löhne und Gehälter", t(-(G.loehne || 0)), "", "C.3"] },
    { type: 'subitem',   cols: ["    b) Soziale Abgaben und Altersversorgung", t(-(G.sozialabgaben || 0)), "", "C.3"] },
    { type: 'total',     cols: ["    Summe Personalaufwand", t(personalSumme), t(-(kennzahlen.vj_personalaufwand || 0)), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'item',      cols: ["7.  Abschreibungen", t(-(G.abschreibungen || 0)), t(-(kennzahlen.vj_abschreibungen || 0)), "C.4"] },
    { type: 'item',      cols: ["8.  Sonstige betriebliche Aufwendungen", t(-(G.sonstige_aufwendungen || 0)), "", ""] },
    { type: 'total',     cols: ["SUMME BETR. AUFWENDUNGEN", t(aufwSumme), "", ""] },
    { type: 'spacer',    cols: [] },
    { type: 'total',     cols: ["BETRIEBSERGEBNIS (EBIT)", t(ebit), t(kennzahlen.vorjahr_ebit || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'group',     cols: ["FINANZERGEBNIS", "", "", ""] },
    { type: 'item',      cols: ["9.  Erträge aus Beteiligungen", t(G.beteiligungsertraege || 0), "", ""] },
    { type: 'item',      cols: ["10. Sonstige Zinsen und ähnliche Erträge", t(G.zinsertraege || 0), "", ""] },
    { type: 'item',      cols: ["11. Abschreibungen auf Finanzanlagen", t(-(G.abschr_finanzanlagen || 0)), "", ""] },
    { type: 'item',      cols: ["12. Zinsen und ähnliche Aufwendungen", t(-(G.zinsaufwendungen || 0)), t(-(kennzahlen.vj_zinsaufwand || 0)), "C.5"] },
    { type: 'total',     cols: ["SUMME FINANZERGEBNIS", t(finanzErg), "", ""] },
    { type: 'spacer',    cols: [] },
    { type: 'total',     cols: ["ERGEBNIS DER GWOENTLICHEN GESCHAEFTSTAEIGKEIT", t(ergebnisGewoehnl), "", ""] },
    { type: 'spacer',    cols: [] },
    { type: 'group',     cols: ["STEUERN", "", "", ""] },
    { type: 'item',      cols: ["13. Steuern vom Einkommen und vom Ertrag", t(-(G.steuern_ertrag || 0)), "", "C.6"] },
    { type: 'item',      cols: ["14. Sonstige Steuern", t(-(G.sonstige_steuern || 0)), "", ""] },
    { type: 'total',     cols: ["SUMME STEUERN", t(steuerSumme), "", ""] },
    { type: 'spacer',    cols: [] },
    { type: 'grandtotal', cols: ["JAHRESUEBERSCHUSS", t(jahresueber), t(kennzahlen.vorjahr_jahresueber || 0), ""] },
    { type: 'spacer',    cols: [] },
    { type: 'group',     cols: ["ERGEBNISVERWENDUNG", "", "", ""] },
    { type: 'item',      cols: ["15. Gewinnvortrag aus Vorjahr", t(B.gewinnvortrag || 0), "", ""] },
    { type: 'item',      cols: ["16. Einstellung in Gewinnrücklagen", t(-(B.einstellung_ruecklagen || 0)), "", "B.4"] },
    { type: 'total',     cols: ["BILANZGEWINN", t(bilanzgewinn), t(B.vj_bilanzgewinn || 0), "B.4"] },
  ];

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", color: C.blue },
          paragraph: { spacing: { before: 520, after: 180 }, outlineLevel: 0 } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1300, bottom: 1440, left: 1300 } } },
      headers: { default: makeHeader(`${company.toUpperCase()}  |  Bilanz und GuV ${year}`) },
      footers: { default: makeFooter(`${company}  |  Jahresabschluss ${year}`) },
      children: [
        ...titlePage({
          firmenname: company, sitz: stammdaten.sitz,
          docTitle: "Jahresabschluss",
          subtitle: "Bilanz  |  Gewinn- und Verlustrechnung",
          year, legalNote: "Gemäß § 242 ff. HGB und § 150 ff. AktG",
        }),
        new Paragraph({ children: [new PageBreak()] }),

        h1("I. Bilanz"),
        divider(),
        h2("Aktivseite"),
        note("Alle Beträge in Tausend Euro (TEUR)."),
        sp(),
        bilanzTable(aktivaRows, BAL),
        sp(2),
        h2("Passivseite"),
        sp(),
        bilanzTable(passivaRows, BAL),
        sp(),
        note(`Bilanzsumme Aktiva: ${t(aktivSumme)} TEUR  |  Bilanzsumme Passiva: ${t(passivSumme)} TEUR`),
        new Paragraph({ children: [new PageBreak()] }),

        h1("II. Gewinn- und Verlustrechnung"),
        divider(),
        h2("Gesamtkostenverfahren gemäß § 275 Abs. 2 HGB"),
        note("Alle Beträge in Tausend Euro (TEUR). Aufwendungen mit negativem Vorzeichen."),
        sp(),
        bilanzTable(guvRows, GUV_COLS),
        sp(2),

        ...signatureBlock(stammdaten.sitz, year, organe.vorstand || []),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { renderBilanzGuV };
