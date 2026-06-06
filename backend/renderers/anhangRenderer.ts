import { Document, Packer, PageBreak, Paragraph, TextRun, AlignmentType, HighlightColor } from 'docx';
import type { JahresabschlussData, AiTexts } from '@nexus/schema';
import type { AnhangSectionTexts, SectionTextOutput } from '../services/openAiSectionTextService';
import {
  sp, divider, h1, h2, h3, para,
  titlePage, makeHeader, makeFooter, signatureBlock,
  dataTable, C, fmt, fmtT,
} from '../utils/docxHelpers';

type RenderableSectionText = Pick<SectionTextOutput, 'text' | 'paragraphs'>;
type JahresabschlussDataWithReportTexts = JahresabschlussData & {
  reportTexts?: Partial<Record<string, RenderableSectionText>>;
};

const valuationFallbackSections = [
  ['anhang.bewertung.allgemeine_grundlagen', 'Allgemeine Bewertungsgrundsätze', 'Der Jahresabschluss wird nach den Vorschriften des HGB aufgestellt. Die Bilanzgliederung erfolgt nach § 266 HGB; die Gewinn- und Verlustrechnung wird nach § 275 HGB nach dem Gesamtkostenverfahren gegliedert.'],
  ['anhang.bewertung.immaterielle_vermoegenswerte', 'Immaterielle Vermögenswerte', 'Entgeltlich erworbene immaterielle Vermögensgegenstände werden zu Anschaffungskosten aktiviert und, soweit sie einer zeitlich begrenzten Nutzung unterliegen, planmäßig über die voraussichtliche wirtschaftliche Nutzungsdauer abgeschrieben. Bei voraussichtlich dauernder Wertminderung erfolgen außerplanmäßige Abschreibungen.'],
  ['anhang.bewertung.sachanlagen', 'Sachanlagen', 'Sachanlagen werden zu Anschaffungs- oder Herstellungskosten, vermindert um planmäßige Abschreibungen, bewertet. Nachträgliche Anschaffungs- oder Herstellungskosten werden aktiviert, soweit sie zu einer Erweiterung oder wesentlichen Verbesserung führen.'],
  ['anhang.bewertung.finanzanlagen', 'Finanzanlagen', 'Finanzanlagen werden zu Anschaffungskosten angesetzt. Bei voraussichtlich dauernder Wertminderung werden außerplanmäßige Abschreibungen vorgenommen.'],
  ['anhang.bewertung.vorraete', 'Vorräte', 'Vorräte werden zu Anschaffungs- oder Herstellungskosten unter Beachtung des strengen Niederstwertprinzips bewertet. Bestandsrisiken aus Lagerdauer, eingeschränkter Verwertbarkeit oder niedrigeren Absatzpreisen werden durch Abwertungen berücksichtigt.'],
  ['anhang.bewertung.forderungen', 'Forderungen und sonstige Vermögensgegenstände', 'Forderungen und sonstige Vermögensgegenstände werden zum Nennwert angesetzt. Erkennbare Einzelrisiken werden durch Wertberichtigungen berücksichtigt.'],
  ['anhang.bewertung.wertpapiere_uv', 'Wertpapiere des Umlaufvermögens', 'Wertpapiere des Umlaufvermögens werden zu Anschaffungskosten oder zum niedrigeren beizulegenden Wert am Bilanzstichtag bewertet.'],
  ['anhang.bewertung.liquide_mittel', 'Liquide Mittel', 'Liquide Mittel werden zum Nennwert angesetzt.'],
  ['anhang.bewertung.aktive_rechnungsabgrenzung', 'Rechnungsabgrenzungsposten', 'Aktive und passive Rechnungsabgrenzungsposten werden für Ausgaben beziehungsweise Einnahmen vor dem Bilanzstichtag gebildet, soweit sie Aufwand oder Ertrag für eine bestimmte Zeit nach dem Bilanzstichtag darstellen.'],
  ['anhang.bewertung.aktive_latente_steuern', 'Latente Steuern', 'Latente Steuern werden für temporäre Differenzen zwischen handelsrechtlichen und steuerlichen Wertansätzen berücksichtigt, soweit die Voraussetzungen hierfür vorliegen.'],
  ['anhang.bewertung.eigenkapital', 'Eigenkapital', 'Das Eigenkapital wird mit dem Nennbetrag ausgewiesen.'],
  ['anhang.bewertung.rueckstellungen', 'Rückstellungen', 'Rückstellungen werden für ungewisse Verbindlichkeiten und drohende Verluste aus schwebenden Geschäften in Höhe des nach vernünftiger kaufmännischer Beurteilung notwendigen Erfüllungsbetrags gebildet.'],
  ['anhang.bewertung.verbindlichkeiten', 'Verbindlichkeiten', 'Verbindlichkeiten werden mit dem Erfüllungsbetrag angesetzt.'],
  ['anhang.bewertung.umsatzerloese', 'Umsatzerlöse', 'Umsatzerlöse werden erfasst, wenn die Lieferung oder Leistung erbracht ist und die Höhe der Gegenleistung verlässlich bestimmt werden kann. Erlösschmälerungen werden von den Umsatzerlösen abgesetzt.'],
  ['anhang.bewertung.bestandsveraenderungen', 'Bestandsveränderungen', 'Bestandsveränderungen werden entsprechend der Veränderung unfertiger und fertiger Erzeugnisse erfasst.'],
  ['anhang.bewertung.aktivierte_eigenleistungen', 'Aktivierte Eigenleistungen', 'Aktivierte Eigenleistungen werden mit den zurechenbaren Herstellungskosten angesetzt, soweit die Aktivierungsvoraussetzungen vorliegen.'],
  ['anhang.bewertung.sonstige_betriebliche_ertraege', 'Sonstige betriebliche Erträge', 'Sonstige betriebliche Erträge werden periodengerecht erfasst, soweit sie dem Geschäftsjahr wirtschaftlich zuzurechnen sind.'],
  ['anhang.bewertung.materialaufwand', 'Materialaufwand', 'Materialaufwendungen werden bei Verbrauch der Roh-, Hilfs- und Betriebsstoffe, bezogenen Waren oder bezogenen Leistungen aufwandswirksam erfasst.'],
  ['anhang.bewertung.personalaufwand', 'Personalaufwand', 'Personalaufwendungen werden periodengerecht erfasst.'],
  ['anhang.bewertung.abschreibungen', 'Abschreibungen', 'Abschreibungen werden planmäßig über die voraussichtliche wirtschaftliche Nutzungsdauer der abnutzbaren Vermögensgegenstände vorgenommen.'],
  ['anhang.bewertung.sonstige_betriebliche_aufwendungen', 'Sonstige betriebliche Aufwendungen', 'Sonstige betriebliche Aufwendungen werden periodengerecht erfasst, soweit sie dem Geschäftsjahr wirtschaftlich zuzurechnen sind.'],
  ['anhang.bewertung.beteiligungsertraege', 'Finanzergebnis', 'Beteiligungs- und Zinserträge sowie Zinsaufwendungen werden periodengerecht erfasst. Abschreibungen auf Finanzanlagen werden vorgenommen, wenn eine voraussichtlich dauernde Wertminderung vorliegt.'],
  ['anhang.bewertung.steuern_einkommen_ertrag', 'Steuern', 'Steuern vom Einkommen und Ertrag sowie sonstige Steuern werden periodengerecht entsprechend der steuerlichen Ergebnisermittlung erfasst.'],
  ['anhang.bewertung.jahresueberschuss', 'Jahresüberschuss', 'Der Jahresüberschuss ergibt sich aus der periodengerechten Erfassung der Erträge und Aufwendungen des Geschäftsjahres.'],
] as const;

function sectionTextParagraphs(sectionText: RenderableSectionText | undefined, fallback: string): Paragraph[] {
  if (!sectionText?.paragraphs?.length) {
    return [para(sectionText?.text || fallback)];
  }

  return sectionText.paragraphs
    .filter(paragraph => paragraph.text && !paragraph.text.includes('[gelb]'))
    .map(paragraph => new Paragraph({
      spacing: { before: 80, after: 140 },
      alignment: AlignmentType.BOTH,
      children: [new TextRun({
        text: paragraph.text,
        size: 22,
        font: 'Arial',
        color: '000000',
        highlight: paragraph.type === 'unconfirmed' ? HighlightColor.YELLOW : undefined,
      })],
    }));
}

function optionalSectionTextParagraphs(sectionText: RenderableSectionText | undefined): Paragraph[] {
  return sectionText ? sectionTextParagraphs(sectionText, '') : [];
}

export async function renderAnhang(data: JahresabschlussData, texts: AiTexts, sectionTexts: AnhangSectionTexts = {}): Promise<Buffer> {
  const { stammdaten, bilanz, guv, organe, kennzahlen, segmente } = data;
  const an = texts.anhang;
  const year = stammdaten.geschaeftsjahr;
  const company = stammdaten.firmenname;
  const py = String(parseInt(year) - 1);
  const reportTexts = (data as JahresabschlussDataWithReportTexts).reportTexts ?? {};
  const K = kennzahlen as unknown as Record<string, number>;

  const B = bilanz;
  const G = guv;

  const personalSumme    = (G.loehne || 0) + (G.sozialabgaben || 0);
  const materialSumme    = (G.material_roh || 0) + (G.material_dienst || 0);
  const umsatz           = G.umsatzerloese || 0;
  const bilanzgewinn     = B.bilanzgewinn || 0;
  const computedJahresueber =
    (G.umsatzerloese || 0) +
    (G.bestandsveraenderung || 0) +
    (G.eigenleistungen || 0) +
    (G.sonstige_ertraege || 0) -
    materialSumme -
    personalSumme -
    (G.abschreibungen || 0) -
    (G.sonstige_aufwendungen || 0) +
    (G.beteiligungsertraege || 0) +
    (G.zinsertraege || 0) -
    (G.abschr_finanzanlagen || 0) -
    (G.zinsaufwendungen || 0) -
    (G.steuern_ertrag || 0) -
    (G.sonstige_steuern || 0);
  const jahresueber      = G.jahresueberschuss || computedJahresueber || 0;
  const ekGes            = (B.gezeichnetes_kapital || 0) + (B.kapitalruecklage || 0) + (B.gesetzliche_ruecklage || 0) + (B.andere_gewinnruecklagen || 0) + bilanzgewinn;
  const dividendeGesamt  = (kennzahlen.dividende_je_aktie || 0) * (stammdaten.anzahl_aktien || 0);
  const einstellungRueckl = B.einstellung_ruecklagen || 0;
  const renderTwoYearTable = (rows: string[][]) =>
    dataTable(["Position", `${year} TEUR`, `${py} TEUR`], rows, [4513, 2257, 2256]);

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", color: C.blue },
          paragraph: { spacing: { before: 520, after: 180 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: C.mid },
          paragraph: { spacing: { before: 340, after: 140 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: C.gray },
          paragraph: { spacing: { before: 260, after: 100 }, outlineLevel: 2 } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1300, bottom: 1440, left: 1300 } } },
      headers: { default: makeHeader(`${company.toUpperCase()}  |  Anhang zum Jahresabschluss ${year}`) },
      footers: { default: makeFooter(`${company}  |  Anhang ${year}`) },
      children: [
        ...titlePage({ firmenname: company, sitz: stammdaten.sitz, docTitle: "Anhang", subtitle: `zum Jahresabschluss für das Geschäftsjahr ${year}`, year, legalNote: "Gemäß § 284 ff. HGB" }),
        new Paragraph({ children: [new PageBreak()] }),

        h1("A. Allgemeine Angaben"), divider(),
        h2("A.1 Rechtliche und wirtschaftliche Grundlagen"), para(an.rechtliche_grundlagen), sp(),
        h2("A.2 Bilanzierungs- und Bewertungsgrundsätze"),
        ...valuationFallbackSections.flatMap((section, index) => [
          h3(`${index + 1}. ${section[1]}`),
          ...sectionTextParagraphs(reportTexts[section[0]], section[2]),
          sp(),
        ]),

        h1("B. Erläuterungen zur Bilanz"), divider(),

        h2("B.1 Immaterielle Vermögenswerte"), sp(),
        renderTwoYearTable(
          [
            ["Lizenzen und Software", fmt(B.immat_lizenzen), fmt(B.vj_immat_lizenzen)],
            ["Selbst erstellte immaterielle Vermögenswerte", fmt(B.immat_selbst), fmt(B.vj_immat_selbst)],
            ["Geleistete Anzahlungen", fmt(B.immat_anzahlungen), fmt(B.vj_immat_anzahlungen)],
            ["Gesamt", fmt(B.immat_vw), fmt(B.vj_immat_vw)],
          ]
        ), sp(), ...optionalSectionTextParagraphs(reportTexts['anhang.immaterielle_vermoegenswerte'] ?? sectionTexts['anhang.immaterielle_vermoegenswerte']), sp(),

        h2("B.1.1 Sachanlagen"), sp(),
        renderTwoYearTable(
          [
            ["Grundstücke und Gebäude", fmt(B.sach_gebaeude), fmt(B.vj_sach_gebaeude)],
            ["Technische Anlagen", fmt(B.sach_maschinen), fmt(B.vj_sach_maschinen)],
            ["Betriebs- und Geschäftsausstattung", fmt(B.sach_ausstattung), fmt(B.vj_sach_ausstattung)],
            ["Anlagen im Bau", fmt(B.sach_anbau), fmt(B.vj_sach_anbau)],
            ["Gesamt", fmt(B.sachanlagen), fmt(B.vj_sachanlagen)],
          ]
        ), sp(), ...optionalSectionTextParagraphs(reportTexts['anhang.sachanlagen'] ?? sectionTexts['anhang.sachanlagen']), sp(),

        h2("B.1.2 Finanzanlagen"), sp(),
        renderTwoYearTable(
          [
            ["Anteile an verbundenen Unternehmen", fmt(B.fin_anteilsvbu), fmt(B.vj_fin_anteilsvbu)],
            ["Ausleihungen an verbundene Unternehmen", fmt(B.fin_ausleihvbu), fmt(B.vj_fin_ausleihvbu)],
            ["Beteiligungen", fmt(B.fin_beteiligungen), fmt(B.vj_fin_beteiligungen)],
            ["Gesamt", fmt(B.finanzanlagen), fmt(B.vj_finanzanlagen)],
          ]
        ), sp(), ...optionalSectionTextParagraphs(reportTexts['anhang.finanzanlagen'] ?? sectionTexts['anhang.finanzanlagen']), sp(),

        h2("B.2 Vorräte"), sp(),
        renderTwoYearTable(
          [
            ["Roh-, Hilfs- und Betriebsstoffe", fmt(B.vorr_rhb),        fmt(B.vj_vorr_rhb)],
            ["Unfertige Erzeugnisse",           fmt(B.vorr_unfertig),   fmt(B.vj_vorr_unfertig)],
            ["Fertige Erzeugnisse und Waren",   fmt(B.vorr_fertig),     fmt(B.vj_vorr_fertig)],
            ["Geleistete Anzahlungen",          fmt(B.vorr_anzahlungen),fmt(B.vj_vorr_anzahlungen)],
            ["Gesamt",                          fmt(B.vorraete),        fmt(B.vj_vorraete)],
          ]
        ), sp(), ...sectionTextParagraphs(reportTexts['anhang.vorraete'] ?? sectionTexts['anhang.vorraete'], an.vorraete_kommentar), sp(),

        h2("B.3 Forderungen"), sp(),
        renderTwoYearTable(
          [
            ["Forderungen aus L. u. L.",            fmt(B.ford_llg),            fmt(B.vj_ford_llg)],
            ["Forderungen gg. verb. Unternehmen",   fmt(B.ford_vbu),            fmt(B.vj_ford_vbu)],
            ["Sonstige Vermögensgegenstände",       fmt(B.ford_sonstige),       fmt(B.vj_ford_sonstige)],
            ["Gesamt",                              fmt(B.forderungen_gesamt),  fmt(B.vj_forderungen)],
          ]
        ), sp(), ...sectionTextParagraphs(reportTexts['anhang.forderungen'] ?? sectionTexts['anhang.forderungen'], an.forderungen_kommentar), sp(),

        h2("B.3.1 Wertpapiere des Umlaufvermögens"), sp(),
        renderTwoYearTable(
          [
            ["Wertpapiere des Umlaufvermögens", fmt(B.wertpapiere_umlauf), fmt(B.vj_wertpapiere)],
          ]
        ), sp(), ...optionalSectionTextParagraphs(reportTexts['anhang.wertpapiere_uv'] ?? sectionTexts['anhang.wertpapiere_uv']), sp(),

        h2("B.3.2 Liquide Mittel"), sp(),
        renderTwoYearTable(
          [
            ["Liquide Mittel", fmt(B.liquide_mittel), fmt(B.vj_liquide_mittel)],
          ]
        ), sp(), ...optionalSectionTextParagraphs(reportTexts['anhang.liquide_mittel'] ?? sectionTexts['anhang.liquide_mittel']), sp(),

        h2("B.4 Eigenkapital"), sp(),
        renderTwoYearTable(
          [
            ["Gezeichnetes Kapital",   fmt(B.gezeichnetes_kapital),     fmt(B.vj_ez_kapital)],
            ["Kapitalrücklage",        fmt(B.kapitalruecklage),         fmt(B.vj_kapruecklage)],
            ["Gesetzliche Rücklage",   fmt(B.gesetzliche_ruecklage),    fmt(B.vj_gesetzliche_ruecklage)],
            ["Andere Gewinnrücklagen", fmt(B.andere_gewinnruecklagen),  fmt(B.vj_andere_gewinnrueckl)],
            ["Bilanzgewinn",           fmt(bilanzgewinn),               fmt(B.vj_bilanzgewinn)],
            ["Gesamt",                 fmt(ekGes),                      fmt(B.vj_eigenkapital)],
          ]
        ), sp(), ...sectionTextParagraphs(reportTexts['anhang.eigenkapital'], an.eigenkapital_kommentar), sp(),

        h2("B.5 Rückstellungen"), sp(),
        renderTwoYearTable(
          [
            ["Pensionsrückstellungen", fmt(B.pensionsrueckstellungen), fmt(B.vj_pensionsrueck)],
            ["Steuerrückstellungen",   fmt(B.steuerrueckstellungen),   fmt(B.vj_steuerrueck)],
            ["Sonstige Rückstellungen",fmt(B.sonstige_rueckstellungen),fmt(B.vj_sonstige_rueck)],
            ["Gesamt",                 fmt((B.pensionsrueckstellungen || 0) + (B.steuerrueckstellungen || 0) + (B.sonstige_rueckstellungen || 0)), fmt(B.vj_rueckstellungen)],
          ]
        ), sp(), ...sectionTextParagraphs(reportTexts['anhang.rueckstellungen'], an.rueckstellungen_kommentar), sp(),

        h2("B.6 Verbindlichkeiten"), sp(),
        renderTwoYearTable(
          [
            ["Anleihen",                         fmt(B.anleihen),                         fmt(B.vj_anleihen)],
            ["Verbindlichkeiten gegenüber Kreditinstituten", fmt(B.verbindlichkeiten_kreditinstitute), fmt(B.vj_verb_kreditinst)],
            ["Erhaltene Anzahlungen",            fmt(B.erhaltene_anzahlungen),             fmt(B.vj_erh_anzahlungen)],
            ["Verbindlichkeiten aus Lieferungen und Leistungen", fmt(B.verbindlichkeiten_llg), fmt(B.vj_verb_llg)],
            ["Verbindlichkeiten gegenüber verbundenen Unternehmen", fmt(B.verbindlichkeiten_vbu), fmt(B.vj_verb_vbu)],
            ["Sonstige Verbindlichkeiten",       fmt(B.sonstige_verbindlichkeiten),        fmt(B.vj_sonst_verb)],
            ["Summe Verbindlichkeiten",          fmt((B.anleihen || 0) + (B.verbindlichkeiten_kreditinstitute || 0) + (B.erhaltene_anzahlungen || 0) + (B.verbindlichkeiten_llg || 0) + (B.verbindlichkeiten_vbu || 0) + (B.sonstige_verbindlichkeiten || 0)), fmt(B.vj_verbindlichkeiten)],
          ]
        ), sp(), ...sectionTextParagraphs(reportTexts['anhang.verbindlichkeiten'] ?? sectionTexts['anhang.verbindlichkeiten'], an.verbindlichkeiten_kommentar), sp(),

        h1("C. Erläuterungen zur Gewinn- und Verlustrechnung"), divider(),

        h2("C.1 Umsatzerlöse"), sp(),
        renderTwoYearTable(
          [
            ...segmente.map(s => [
              s.name,
              fmt(s.umsatz),
              fmt(s.vorjahr_umsatz),
            ]),
            ["Gesamt Umsatzerlöse", fmt(umsatz), fmt(kennzahlen.vorjahr_umsatz)],
          ]
        ), sp(), ...sectionTextParagraphs(reportTexts['anhang.guv.umsatzerloese'], an.umsatz_kommentar), sp(),

        h2("C.2 Sonstige betriebliche Erträge"), sp(),
        renderTwoYearTable(
          [
            ["Sonstige betriebliche Erträge", fmt(G.sonstige_ertraege), fmt(kennzahlen.vj_sonstige_ertraege)],
          ]
        ), sp(), ...optionalSectionTextParagraphs(reportTexts['anhang.guv.sonstige_betriebliche_ertraege'] ?? sectionTexts['anhang.guv.sonstige_betriebliche_ertraege']), sp(),

        h2("C.2.1 Materialaufwand"), sp(),
        renderTwoYearTable(
          [
            ["Aufwendungen für Roh-, Hilfs- und Betriebsstoffe", fmt(G.material_roh), fmt(K.vj_material_roh)],
            ["Aufwendungen für bezogene Leistungen", fmt(G.material_dienst), fmt(K.vj_material_dienst)],
            ["Gesamt Materialaufwand", fmt(materialSumme), fmt(kennzahlen.vj_materialaufwand)],
          ]
        ), sp(), ...optionalSectionTextParagraphs(reportTexts['anhang.guv.materialaufwand'] ?? sectionTexts['anhang.guv.materialaufwand']), sp(),

        h2("C.3 Personalaufwand"), sp(),
        renderTwoYearTable(
          [
            ["Löhne und Gehälter",               fmt(G.loehne),       fmt(kennzahlen.vj_loehne)],
            ["Soziale Abgaben und Altersversorgung", fmt(G.sozialabgaben), fmt(kennzahlen.vj_sozialabgaben)],
            ["Gesamt Personalaufwand",            fmt(personalSumme), fmt(kennzahlen.vj_personalaufwand)],
          ]
        ), sp(), ...sectionTextParagraphs(reportTexts['anhang.guv.personalaufwand'], an.personal_kommentar), sp(),

        h2("C.4 Abschreibungen"), sp(),
        renderTwoYearTable(
          [
            ["Abschreibungen", fmt(G.abschreibungen), fmt(kennzahlen.vj_abschreibungen)],
          ]
        ), sp(), ...optionalSectionTextParagraphs(reportTexts['anhang.guv.abschreibungen'] ?? sectionTexts['anhang.guv.abschreibungen']), sp(),

        h2("C.5 Sonstige betriebliche Aufwendungen"), sp(),
        renderTwoYearTable(
          [
            ["Sonstige betriebliche Aufwendungen", fmt(G.sonstige_aufwendungen), fmt(K.vj_sonstige_aufwendungen || K.vj_sonstige_aufwend)],
          ]
        ), sp(), ...optionalSectionTextParagraphs(reportTexts['anhang.guv.sonstige_betriebliche_aufwendungen'] ?? sectionTexts['anhang.guv.sonstige_betriebliche_aufwendungen']), sp(),

        h1("D. Sonstige Pflichtangaben"), divider(),

        h2("D.2 Derivative Finanzinstrumente (§ 285 Nr. 19 HGB)"), para(an.derivate_kommentar), sp(),

        h2("D.3 Verbundene Unternehmen und Beteiligungen (§ 285 Nr. 11 HGB)"), sp(),
        ...(data.beteiligungen && data.beteiligungen.length > 0 ? [
          dataTable(
            ["Gesellschaft", "Sitz", "Anteil %", "EK TEUR", "Ergebnis TEUR"],
            data.beteiligungen.map(b => [b.name, b.sitz, b.anteil, fmt(b.eigenkapital), fmt(b.ergebnis)]),
            [2600, 1500, 800, 1563, 1563]
          ), sp(),
        ] : [para("Eine vollständige Aufstellung des Anteilsbesitzes wird gemäß § 285 Nr. 11 HGB im elektronischen Bundesanzeiger veröffentlicht.")]),
        sp(),

        h2("D.4 Organmitglieder (§ 285 Nr. 9, 10 HGB)"),
        h3("Vorstand"), sp(),
        dataTable(
          ["Name", "Funktion", "Bestellt bis"],
          (organe.vorstand || []).map(v => [v.name, v.funktion, v.bestellt_bis ?? ""]),
          [2800, 3400, 2826]
        ), sp(),
        ...(organe.aufsichtsrat && organe.aufsichtsrat.length > 0 ? [
          h3("Aufsichtsrat"), sp(),
          dataTable(["Name", "Funktion"], organe.aufsichtsrat.map(a => [a.name, a.funktion ?? ""]), [5013, 4013]),
          sp(),
        ] : []),

        h2("D.5 Abschlussprüferhonorar (§ 285 Nr. 17 HGB)"), sp(),
        dataTable(
          ["Leistungsart", `GJ ${year} TEUR`],
          [
            ["Abschlussprüfung",             fmt(kennzahlen.prueferhonorar_pruefung)],
            ["Andere Bestätigungsleistungen",fmt(kennzahlen.prueferhonorar_sonstig)],
            ["Gesamt",                       fmt((kennzahlen.prueferhonorar_pruefung || 0) + (kennzahlen.prueferhonorar_sonstig || 0))],
          ],
          [5500, 3526]
        ), sp(),

        h2("D.6 Nahestehende Personen und Unternehmen (§ 285 Nr. 21 HGB)"), para(an.nahestehende_kommentar), sp(),

        h2("D.7 Ergebnisverwendungsvorschlag (§ 170 Abs. 2 AktG)"), sp(),
        dataTable(
          ["Position", "Betrag TEUR"],
          [
            [`Jahresüberschuss ${year}`,                                fmt(jahresueber)],
            ["Gewinnvortrag aus dem Vorjahr",                           fmt(B.gewinnvortrag)],
            ["Bilanzgewinn",                                            fmt(bilanzgewinn)],
            ["Einstellung in andere Gewinnrücklagen",                   fmt(-einstellungRueckl)],
            [`Dividendenvorschlag (${(kennzahlen.dividende_je_aktie || 0).toFixed(2)} EUR/Aktie)`, fmt(dividendeGesamt)],
          ],
          [5500, 3526]
        ), sp(),

        h2("D.8 Entsprechenserklärung (§ 161 AktG)"),
        para(`Vorstand und Aufsichtsrat der ${company} haben die gemäß § 161 AktG vorgeschriebene Erklärung zum Deutschen Corporate Governance Kodex abgegeben und auf der Internetseite der Gesellschaft dauerhaft zugänglich gemacht.`), sp(),

        h2("D.9 Ereignisse nach dem Bilanzstichtag"),
        para(an.ereignisse_nach_stichtag || "Nach dem Bilanzstichtag sind keine wesentlichen Ereignisse eingetreten."), sp(2),

        h1("E. Bestätigungsvermerk des Abschlussprüfers"), divider(),
        para("[Der Bestätigungsvermerk wird nach Abschluss der Prüfung eingefügt.]"), sp(3),

        ...signatureBlock(stammdaten.sitz, year, organe.vorstand || []),
      ],
    }],
  });

  return Packer.toBuffer(doc) as unknown as Buffer;
}
