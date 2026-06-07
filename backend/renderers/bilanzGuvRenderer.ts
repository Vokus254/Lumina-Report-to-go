import { Document, Packer, PageBreak, Paragraph, TextRun } from 'docx';
import type { JahresabschlussData, AiTexts } from '../../packages/schema/src';
import {
  sp, divider, h1, h2, note,
  titlePage, makeHeader, makeFooter, signatureBlock,
  bilanzTable, C, fmt,
} from '../utils/docxHelpers';

// ── Format TEUR value – empty string for 0 ─────────────────────────
function t(n: number | null | undefined): string {
  if (n == null || Number(n) === 0) return "";
  const abs = Math.abs(Number(n));
  const neg = Number(n) < 0;
  return (neg ? "-" : "") + abs.toLocaleString('de-DE');
}

/** VJ column: blank when value is 0 / not entered */
function vj(n: number | null | undefined): string {
  if (!n || Number(n) === 0) return "";
  return t(n);
}

function fieldNumber(source: object, ...names: string[]): number | undefined {
  const record = source as Record<string, unknown>;
  for (const name of names) {
    const value = record[name];
    if (typeof value === 'number') return value;
  }
  return undefined;
}

export async function renderBilanzGuV(data: JahresabschlussData, _texts: AiTexts): Promise<Buffer> {
  const { stammdaten, bilanz, guv, organe, kennzahlen } = data;
  const year    = stammdaten.geschaeftsjahr;
  const company = stammdaten.firmenname;
  const B = bilanz;
  const G = guv;

  const py = kennzahlen.vorjahr_bilanzsumme != null
    ? String(parseInt(year) - 1)
    : String(parseInt(year) - 1);

  // ── Computed values ─────────────────────────────────────────────
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

  const gesamtleistung = (G.umsatzerloese || 0) + (G.bestandsveraenderung || 0) + (G.eigenleistungen || 0) + (G.sonstige_ertraege || 0);
  const materialSumme  = -Math.abs((G.material_roh || 0) + (G.material_dienst || 0));
  const personalSumme  = -Math.abs((G.loehne || 0) + (G.sozialabgaben || 0));
  const aufwSumme      = materialSumme + personalSumme - Math.abs(G.abschreibungen || 0) - Math.abs(G.sonstige_aufwendungen || 0);
  const ebit           = gesamtleistung + aufwSumme;
  const finanzErg      = (G.beteiligungsertraege || 0) + (G.zinsertraege || 0) - Math.abs(G.zinsaufwendungen || 0) - Math.abs(G.abschr_finanzanlagen || 0);
  const ergebnisGewoehnl = ebit + finanzErg;
  const steuerSumme    = -Math.abs((G.steuern_ertrag || 0) + (G.sonstige_steuern || 0));
  const jahresueber    = ergebnisGewoehnl + steuerSumme;

  const BAL = [4200, 1608, 1608, 1610];
  const aktivaRows = [
    { type: 'header' as const,    cols: ["AKTIVA", `${year} TEUR`, `${py} TEUR`, "Anhang"] },
    { type: 'group' as const,     cols: ["A.  ANLAGEVERMOEGEN", "", "", ""] },
    { type: 'subgroup' as const,  cols: ["I.  Immaterielle Vermögenswerte", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    Entgeltlich erw. Rechte und Lizenzen", t(B.immat_lizenzen), vj(B.vj_immat_lizenzen), "B.1"] },
    { type: 'subitem' as const,   cols: ["    Selbst erstellte immat. Vermögenswerte", t(B.immat_selbst), vj(B.vj_immat_selbst), "B.1"] },
    { type: 'subitem' as const,   cols: ["    Geleistete Anzahlungen", t(B.immat_anzahlungen), vj(B.vj_immat_anzahlungen), "B.1"] },
    { type: 'total' as const,     cols: ["    Summe immat. Vermögenswerte", t(B.immat_vw), vj(B.vj_immat_vw), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'subgroup' as const,  cols: ["II. Sachanlagen", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    Grundstücke und Gebäude", t(B.sach_gebaeude), vj(B.vj_sach_gebaeude), "B.1"] },
    { type: 'subitem' as const,   cols: ["    Techn. Anlagen und Maschinen", t(B.sach_maschinen), vj(B.vj_sach_maschinen), "B.1"] },
    { type: 'subitem' as const,   cols: ["    Betriebs- und Geschäftsausstattung", t(B.sach_ausstattung), vj(B.vj_sach_ausstattung), "B.1"] },
    { type: 'subitem' as const,   cols: ["    Anlagen im Bau / Anzahlungen", t(B.sach_anbau), vj(B.vj_sach_anbau), "B.1"] },
    { type: 'total' as const,     cols: ["    Summe Sachanlagen", t(B.sachanlagen), vj(B.vj_sachanlagen), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'subgroup' as const,  cols: ["III.Finanzanlagen", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    Anteile an verbundenen Unternehmen", t(B.fin_anteilsvbu), vj(B.vj_fin_anteilsvbu), "B.1"] },
    { type: 'subitem' as const,   cols: ["    Ausleihungen an verbundene Unternehmen", t(B.fin_ausleihvbu), vj(B.vj_fin_ausleihvbu), "B.1"] },
    { type: 'subitem' as const,   cols: ["    Beteiligungen", t(B.fin_beteiligungen), vj(B.vj_fin_beteiligungen), "B.1"] },
    { type: 'total' as const,     cols: ["    Summe Finanzanlagen", t(B.finanzanlagen), vj(B.vj_finanzanlagen), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'total' as const,     cols: ["SUMME ANLAGEVERMOEGEN", t(anlageSumme), vj(B.vj_anlagevermoegen), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'group' as const,     cols: ["B.  UMLAUFVERMOEGEN", "", "", ""] },
    { type: 'subgroup' as const,  cols: ["I.  Vorräte", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    Roh-, Hilfs- und Betriebsstoffe", t(B.vorr_rhb), vj(B.vj_vorr_rhb), "B.2"] },
    { type: 'subitem' as const,   cols: ["    Unfertige Erzeugnisse", t(B.vorr_unfertig), vj(B.vj_vorr_unfertig), "B.2"] },
    { type: 'subitem' as const,   cols: ["    Fertige Erzeugnisse und Waren", t(B.vorr_fertig), vj(B.vj_vorr_fertig), "B.2"] },
    { type: 'subitem' as const,   cols: ["    Geleistete Anzahlungen", t(B.vorr_anzahlungen), vj(B.vj_vorr_anzahlungen), "B.2"] },
    { type: 'total' as const,     cols: ["    Summe Vorräte", t(B.vorraete), vj(B.vj_vorraete), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'subgroup' as const,  cols: ["II. Forderungen und sonst. Vermögensgegenstande", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    Forderungen aus Lieferungen u. Leistungen", t(B.ford_llg), vj(B.vj_ford_llg), "B.3"] },
    { type: 'subitem' as const,   cols: ["    Forderungen gg. verbundene Unternehmen", t(B.ford_vbu), vj(B.vj_ford_vbu), "B.3"] },
    { type: 'subitem' as const,   cols: ["    Sonstige Vermögensgegenstande", t(B.ford_sonstige), vj(B.vj_ford_sonstige), "B.3"] },
    { type: 'total' as const,     cols: ["    Summe Forderungen", t(B.forderungen_gesamt), vj(B.vj_forderungen), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'subgroup' as const,  cols: ["III.Wertpapiere des Umlaufvermogens", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    Sonstige Wertpapiere", t(B.wertpapiere_umlauf), vj(B.vj_wertpapiere), ""] },
    { type: 'total' as const,     cols: ["    Summe Wertpapiere", t(B.wertpapiere_umlauf), vj(B.vj_wertpapiere), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'subgroup' as const,  cols: ["IV. Kassenbestand und Bankguthaben", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    Liquide Mittel", t(B.liquide_mittel), vj(B.vj_liquide_mittel), ""] },
    { type: 'total' as const,     cols: ["    Summe liquide Mittel", t(B.liquide_mittel), vj(B.vj_liquide_mittel), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'total' as const,     cols: ["SUMME UMLAUFVERMOEGEN", t(umlaufSumme), vj(B.vj_umlaufvermoegen), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'group' as const,     cols: ["C.  RECHNUNGSABGRENZUNGSPOSTEN", "", "", ""] },
    { type: 'item' as const,      cols: ["    Aktive RAP", t(B.aktiver_rao), vj(B.vj_aktiver_rao), ""] },
    { type: 'group' as const,     cols: ["D.  AKTIVE LATENTE STEUERN", "", "", ""] },
    { type: 'item' as const,      cols: ["    Aktive latente Steuern (§ 274 HGB)", t(B.aktive_latente_steuern), vj(B.vj_aktive_latente), "B.7"] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'grandtotal' as const, cols: ["BILANZSUMME AKTIVA", t(aktivSumme), vj(B.vj_bilanzsumme), ""] },
  ];

  const passivaRows = [
    { type: 'header' as const,    cols: ["PASSIVA", `${year} TEUR`, `${py} TEUR`, "Anhang"] },
    { type: 'group' as const,     cols: ["A.  EIGENKAPITAL", "", "", ""] },
    { type: 'item' as const,      cols: ["I.  Gezeichnetes Kapital", t(gezeichKap), vj(B.vj_ez_kapital), "B.4"] },
    { type: 'item' as const,      cols: ["II. Kapitalrücklage", t(kapRueckl), vj(B.vj_kapruecklage), "B.4"] },
    { type: 'subgroup' as const,  cols: ["III.Gewinnrücklagen", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    Gesetzliche Rücklage", t(B.gesetzliche_ruecklage), vj(B.vj_gesetzliche_ruecklage), "B.4"] },
    { type: 'subitem' as const,   cols: ["    Andere Gewinnrücklagen", t(B.andere_gewinnruecklagen), vj(B.vj_andere_gewinnrueckl), "B.4"] },
    { type: 'total' as const,     cols: ["    Summe Gewinnrücklagen", t(gewinnRueckl), vj(B.vj_gewinnruecklagen), ""] },
    { type: 'item' as const,      cols: ["IV. Bilanzgewinn", t(bilanzgewinn), vj(B.vj_bilanzgewinn), "B.4"] },
    { type: 'total' as const,     cols: ["SUMME EIGENKAPITAL", t(gezeichKap + kapRueckl + gewinnRueckl + bilanzgewinn), vj(B.vj_eigenkapital), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'group' as const,     cols: ["B.  RUECKSTELLUNGEN", "", "", ""] },
    { type: 'item' as const,      cols: ["1.  Pensionsrückstellungen", t(B.pensionsrueckstellungen), vj(B.vj_pensionsrueck), "B.5"] },
    { type: 'item' as const,      cols: ["2.  Steuerrückstellungen", t(B.steuerrueckstellungen), vj(B.vj_steuerrueck), "B.5"] },
    { type: 'item' as const,      cols: ["3.  Sonstige Rückstellungen", t(B.sonstige_rueckstellungen), vj(B.vj_sonstige_rueck), "B.5"] },
    { type: 'total' as const,     cols: ["SUMME RUECKSTELLUNGEN", t(rueckstSumme), vj(B.vj_rueckstellungen), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'group' as const,     cols: ["C.  VERBINDLICHKEITEN", "", "", ""] },
    { type: 'item' as const,      cols: ["1.  Anleihen", t(B.anleihen), vj(B.vj_anleihen), "B.6"] },
    { type: 'item' as const,      cols: ["2.  Verbindlichkeiten gg. Kreditinstitute", t(B.verbindlichkeiten_kreditinstitute), vj(B.vj_verb_kreditinst), "B.6"] },
    { type: 'item' as const,      cols: ["3.  Erhaltene Anzahlungen", t(B.erhaltene_anzahlungen), vj(B.vj_erh_anzahlungen), "B.6"] },
    { type: 'item' as const,      cols: ["4.  Verbindlichkeiten aus L. u. L.", t(B.verbindlichkeiten_llg), vj(B.vj_verb_llg), "B.6"] },
    { type: 'item' as const,      cols: ["5.  Verbindlichkeiten gg. verbundene Unternehmen", t(B.verbindlichkeiten_vbu), vj(B.vj_verb_vbu), "B.6"] },
    { type: 'item' as const,      cols: ["6.  Sonstige Verbindlichkeiten", t(B.sonstige_verbindlichkeiten), vj(vjSonstigeVerb == null ? undefined : Math.round(vjSonstigeVerb)), "B.6"] },
    { type: 'total' as const,     cols: ["SUMME VERBINDLICHKEITEN", t(verbSumme), vj(vjVerbSumme == null ? undefined : Math.round(vjVerbSumme)), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'group' as const,     cols: ["D.  RECHNUNGSABGRENZUNGSPOSTEN", "", "", ""] },
    { type: 'item' as const,      cols: ["    Passive RAP", t(B.passiver_rao), vj(B.vj_passiver_rao), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'grandtotal' as const, cols: ["BILANZSUMME PASSIVA", t(passivSumme), vj(B.vj_bilanzsumme), ""] },
  ];

  const GUV_COLS = [4700, 1513, 1513, 1300];
  const guvRows = [
    { type: 'header' as const,    cols: ["POSITION", `GJ ${year} TEUR`, `GJ ${py} TEUR`, "Anhang"] },
    { type: 'group' as const,     cols: ["ERLOESE UND SONSTIGE ERTRAEGE", "", "", ""] },
    { type: 'item' as const,      cols: ["1.  Umsatzerlöse", t(G.umsatzerloese), vj(kennzahlen.vorjahr_umsatz), "C.1"] },
    { type: 'item' as const,      cols: ["2.  Bestandsveränderung", t(G.bestandsveraenderung), "", ""] },
    { type: 'item' as const,      cols: ["3.  Andere aktivierte Eigenleistungen", t(G.eigenleistungen), "", ""] },
    { type: 'item' as const,      cols: ["4.  Sonstige betriebliche Erträge", t(G.sonstige_ertraege), vj(kennzahlen.vj_sonstige_ertraege), "C.2"] },
    { type: 'total' as const,     cols: ["GESAMTLEISTUNG", t(gesamtleistung), "", ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'group' as const,     cols: ["BETRIEBLICHE AUFWENDUNGEN", "", "", ""] },
    { type: 'item' as const,      cols: ["5.  Materialaufwand", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    a) Roh-, Hilfs- u. Betriebsstoffe, bezogene Waren", t(-(G.material_roh || 0)), "", ""] },
    { type: 'subitem' as const,   cols: ["    b) Bezogene Leistungen", t(-(G.material_dienst || 0)), "", ""] },
    { type: 'total' as const,     cols: ["    Summe Materialaufwand", t(materialSumme), kennzahlen.vj_materialaufwand ? t(-kennzahlen.vj_materialaufwand) : "", ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'item' as const,      cols: ["6.  Personalaufwand", "", "", ""] },
    { type: 'subitem' as const,   cols: ["    a) Löhne und Gehälter", t(-(G.loehne || 0)), "", "C.3"] },
    { type: 'subitem' as const,   cols: ["    b) Soziale Abgaben und Altersversorgung", t(-(G.sozialabgaben || 0)), "", "C.3"] },
    { type: 'total' as const,     cols: ["    Summe Personalaufwand", t(personalSumme), kennzahlen.vj_personalaufwand ? t(-kennzahlen.vj_personalaufwand) : "", ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'item' as const,      cols: ["7.  Abschreibungen", t(-(G.abschreibungen || 0)), kennzahlen.vj_abschreibungen ? t(-kennzahlen.vj_abschreibungen) : "", "C.4"] },
    { type: 'item' as const,      cols: ["8.  Sonstige betriebliche Aufwendungen", t(-(G.sonstige_aufwendungen || 0)), "", ""] },
    { type: 'total' as const,     cols: ["SUMME BETR. AUFWENDUNGEN", t(aufwSumme), "", ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'total' as const,     cols: ["BETRIEBSERGEBNIS (EBIT)", t(ebit), vj(kennzahlen.vorjahr_ebit), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'group' as const,     cols: ["FINANZERGEBNIS", "", "", ""] },
    { type: 'item' as const,      cols: ["9.  Erträge aus Beteiligungen", t(G.beteiligungsertraege), "", ""] },
    { type: 'item' as const,      cols: ["10. Sonstige Zinsen und ähnliche Erträge", t(G.zinsertraege), "", ""] },
    { type: 'item' as const,      cols: ["11. Abschreibungen auf Finanzanlagen", t(-(G.abschr_finanzanlagen || 0)), "", ""] },
    { type: 'item' as const,      cols: ["12. Zinsen und ähnliche Aufwendungen", t(-(G.zinsaufwendungen || 0)), kennzahlen.vj_zinsaufwand ? t(-kennzahlen.vj_zinsaufwand) : "", "C.5"] },
    { type: 'total' as const,     cols: ["SUMME FINANZERGEBNIS", t(finanzErg), "", ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'total' as const,     cols: ["ERGEBNIS DER GWOENTLICHEN GESCHAEFTSTAEIGKEIT", t(ergebnisGewoehnl), "", ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'group' as const,     cols: ["STEUERN", "", "", ""] },
    { type: 'item' as const,      cols: ["13. Steuern vom Einkommen und vom Ertrag", t(-(G.steuern_ertrag || 0)), "", "C.6"] },
    { type: 'item' as const,      cols: ["14. Sonstige Steuern", t(-(G.sonstige_steuern || 0)), "", ""] },
    { type: 'total' as const,     cols: ["SUMME STEUERN", t(steuerSumme), "", ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'grandtotal' as const, cols: ["JAHRESUEBERSCHUSS", t(jahresueber), vj(kennzahlen.vorjahr_jahresueber), ""] },
    { type: 'spacer' as const,    cols: [] },
    { type: 'group' as const,     cols: ["ERGEBNISVERWENDUNG", "", "", ""] },
    { type: 'item' as const,      cols: ["15. Gewinnvortrag aus Vorjahr", t(B.gewinnvortrag), "", ""] },
    { type: 'item' as const,      cols: ["16. Einstellung in Gewinnrücklagen", t(-(B.einstellung_ruecklagen || 0)), "", "B.4"] },
    { type: 'total' as const,     cols: ["BILANZGEWINN", t(bilanzgewinn), vj(B.vj_bilanzgewinn), "B.4"] },
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
        ...titlePage({ firmenname: company, sitz: stammdaten.sitz, docTitle: "Jahresabschluss", subtitle: "Bilanz  |  Gewinn- und Verlustrechnung", year, legalNote: "Gemäß § 242 ff. HGB und § 150 ff. AktG" }),
        new Paragraph({ children: [new PageBreak()] }),
        h1("I. Bilanz"), divider(), h2("Aktivseite"), note("Alle Beträge in Tausend Euro (TEUR)."), sp(),
        bilanzTable(aktivaRows, BAL), sp(2),
        h2("Passivseite"), sp(), bilanzTable(passivaRows, BAL), sp(),
        note(`Bilanzsumme Aktiva: ${t(aktivSumme)} TEUR  |  Bilanzsumme Passiva: ${t(passivSumme)} TEUR`),
        new Paragraph({ children: [new PageBreak()] }),
        h1("II. Gewinn- und Verlustrechnung"), divider(),
        h2("Gesamtkostenverfahren gemäß § 275 Abs. 2 HGB"),
        note("Alle Beträge in Tausend Euro (TEUR). Aufwendungen mit negativem Vorzeichen."),
        sp(), bilanzTable(guvRows, GUV_COLS), sp(2),
        ...signatureBlock(stammdaten.sitz, year, organe.vorstand || []),
      ],
    }],
  });

  return Packer.toBuffer(doc) as unknown as Buffer;
}
