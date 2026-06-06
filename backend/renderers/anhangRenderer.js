const { Document, Packer, PageBreak, Paragraph, TextRun } = require('docx');
const {
  sp, divider, h1, h2, h3, para, note,
  titlePage, makeHeader, makeFooter, signatureBlock,
  dataTable, C, fmt, fmtT,
} = require('../utils/docxHelpers');

async function renderAnhang(data, texts) {
  const { stammdaten, bilanz, guv, organe, kennzahlen, segmente } = data;
  const an = texts.anhang || {};
  const year = stammdaten.geschaeftsjahr;
  const company = stammdaten.firmenname;
  const py = String(parseInt(year) - 1);

  const B = bilanz;
  const G = guv;

  // Compute a few derived values for the tables
  const personalSumme = (G.loehne || 0) + (G.sozialabgaben || 0);
  const umsatz = G.umsatzerloese || 0;
  const ebit = G.betriebsergebnis || 0;
  const jahresueber = G.jahresueberschuss || 0;
  const bilanzgewinn = B.bilanzgewinn || 0;
  const ekGes = (B.gezeichnetes_kapital || 0) + (B.kapitalruecklage || 0) + (B.gesetzliche_ruecklage || 0) + (B.andere_gewinnruecklagen || 0) + bilanzgewinn;
  const dividendeGesamt = (kennzahlen.dividende_je_aktie || 0) * (stammdaten.anzahl_aktien || 0);
  const einstellungRueckl = B.einstellung_ruecklagen || 0;

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
        ...titlePage({
          firmenname: company, sitz: stammdaten.sitz,
          docTitle: "Anhang",
          subtitle: `zum Jahresabschluss für das Geschäftsjahr ${year}`,
          year, legalNote: "Gemäß § 284 ff. HGB",
        }),
        new Paragraph({ children: [new PageBreak()] }),

        // ── A. Allgemeine Angaben ──────────────────────────────────
        h1("A. Allgemeine Angaben"),
        divider(),
        h2("A.1 Rechtliche und wirtschaftliche Grundlagen"),
        para(an.rechtliche_grundlagen || ""),
        sp(),
        h2("A.2 Bilanzierungs- und Bewertungsgrundsätze"),
        para(an.bilanzierungsgrundsaetze_intro || ""),
        sp(),
        h3("Immaterielle Vermögenswerte"),
        para(an.bewertung_immaterielle || ""),
        h3("Sachanlagen"),
        para(an.bewertung_sachanlagen || ""),
        h3("Vorräte"),
        para(an.bewertung_vorraete || ""),
        h3("Forderungen"),
        para(an.bewertung_forderungen || ""),
        h3("Rückstellungen"),
        para(an.bewertung_rueckstellungen || ""),
        sp(),

        // ── B. Bilanz-Erlaeuterungen ───────────────────────────────
        h1("B. Erlauterungen zur Bilanz"),
        divider(),

        h2("B.2 Vorräte"),
        sp(),
        dataTable(
          ["Position", `${year} TEUR`, `${py} TEUR`],
          [
            ["Roh-, Hilfs- und Betriebsstoffe", fmt(B.vorr_rhb || 0), fmt(B.vj_vorr_rhb || 0)],
            ["Unfertige Erzeugnisse", fmt(B.vorr_unfertig || 0), fmt(B.vj_vorr_unfertig || 0)],
            ["Fertige Erzeugnisse und Waren", fmt(B.vorr_fertig || 0), fmt(B.vj_vorr_fertig || 0)],
            ["Geleistete Anzahlungen", fmt(B.vorr_anzahlungen || 0), fmt(B.vj_vorr_anzahlungen || 0)],
            ["Gesamt", fmt(B.vorraete || 0), fmt(B.vj_vorraete || 0)],
          ],
          [4513, 2257, 2256]
        ),
        sp(),
        para(an.vorraete_kommentar || ""),
        sp(),

        h2("B.3 Forderungen"),
        sp(),
        dataTable(
          ["Position", `Gesamt ${year} TEUR`, `davon > 1 Jahr TEUR`],
          [
            ["Forderungen aus L. u. L.", fmt(B.ford_llg || 0), fmt(B.ford_llg_gt1y || 0)],
            ["Forderungen gg. verb. Unternehmen", fmt(B.ford_vbu || 0), fmt(B.ford_vbu_gt1y || 0)],
            ["Sonstige Vermögensgegenstande", fmt(B.ford_sonstige || 0), fmt(B.ford_sonstige_gt1y || 0)],
            ["Gesamt", fmt(B.forderungen_gesamt || 0), fmt(B.ford_gesamt_gt1y || 0)],
          ],
          [4513, 2257, 2256]
        ),
        sp(),
        para(an.forderungen_kommentar || ""),
        sp(),

        h2("B.4 Eigenkapital"),
        sp(),
        dataTable(
          ["Eigenkapitalposition", `01.01.${year} TEUR`, `Veränderung TEUR`, `31.12.${year} TEUR`],
          [
            ["Gezeichnetes Kapital", fmt(B.vj_ez_kapital || B.gezeichnetes_kapital || 0), "0", fmt(B.gezeichnetes_kapital || 0)],
            ["Kapitalrücklage", fmt(B.vj_kapruecklage || B.kapitalruecklage || 0), "0", fmt(B.kapitalruecklage || 0)],
            ["Gesetzliche Rücklage", fmt(B.vj_gesetzliche_ruecklage || B.gesetzliche_ruecklage || 0), "0", fmt(B.gesetzliche_ruecklage || 0)],
            ["Andere Gewinnrücklagen", fmt(B.vj_andere_gewinnrueckl || 0), fmt((B.andere_gewinnruecklagen || 0) - (B.vj_andere_gewinnrueckl || 0)), fmt(B.andere_gewinnruecklagen || 0)],
            ["Bilanzgewinn", fmt(B.vj_bilanzgewinn || 0), fmt(bilanzgewinn - (B.vj_bilanzgewinn || 0)), fmt(bilanzgewinn)],
            ["Gesamt", fmt(B.vj_eigenkapital || 0), fmt(ekGes - (B.vj_eigenkapital || 0)), fmt(ekGes)],
          ],
          [3500, 1842, 1842, 1842]
        ),
        sp(),
        para(an.eigenkapital_kommentar || ""),
        sp(),

        h2("B.5 Rückstellungen"),
        sp(),
        dataTable(
          ["Rückstellungsart", `01.01.${year} TEUR`, `Zugang TEUR`, `Verbrauch/Aufl. TEUR`, `31.12.${year} TEUR`],
          [
            ["Pensionsrückstellungen", fmt(B.vj_pensionsrueck || 0), fmt(B.zugang_pensionsrueck || 0), fmt(B.abgang_pensionsrueck || 0), fmt(B.pensionsrueckstellungen || 0)],
            ["Steuerrückstellungen", fmt(B.vj_steuerrueck || 0), fmt(B.zugang_steuerrueck || 0), fmt(B.abgang_steuerrueck || 0), fmt(B.steuerrueckstellungen || 0)],
            ["Sonstige Rückstellungen", fmt(B.vj_sonstige_rueck || 0), fmt(B.zugang_sonstige_rueck || 0), fmt(B.abgang_sonstige_rueck || 0), fmt(B.sonstige_rueckstellungen || 0)],
            ["Gesamt", fmt(B.vj_rueckstellungen || 0), "", "", fmt((B.pensionsrueckstellungen || 0) + (B.steuerrueckstellungen || 0) + (B.sonstige_rueckstellungen || 0))],
          ],
          [2700, 1200, 1200, 1200, 1726]
        ),
        sp(),
        para(an.rueckstellungen_kommentar || ""),
        sp(),

        h2("B.6 Verbindlichkeiten"),
        sp(),
        dataTable(
          ["Verbindlichkeitsart", `Gesamt ${year} TEUR`, "< 1 Jahr TEUR", "1-5 Jahre TEUR", "> 5 Jahre TEUR"],
          [
            ["Anleihen", fmt(B.anleihen || 0), fmt(B.anleihen_lt1y || 0), fmt(B.anleihen_1to5y || 0), fmt(B.anleihen_gt5y || 0)],
            ["Verb. gg. Kreditinstitute", fmt(B.verbindlichkeiten_kreditinstitute || 0), fmt(B.verb_ki_lt1y || 0), fmt(B.verb_ki_1to5y || 0), fmt(B.verb_ki_gt5y || 0)],
            ["Verb. aus L. u. L.", fmt(B.verbindlichkeiten_llg || 0), fmt(B.verbindlichkeiten_llg || 0), "0", "0"],
            ["Verb. gg. verb. Unternehmen", fmt(B.verbindlichkeiten_vbu || 0), fmt(B.verbindlichkeiten_vbu || 0), "0", "0"],
            ["Sonstige Verbindlichkeiten", fmt(B.sonstige_verbindlichkeiten || 0), fmt(B.sonst_verb_lt1y || 0), fmt(B.sonst_verb_1to5y || 0), "0"],
          ],
          [2900, 1381, 1381, 1382, 982]
        ),
        sp(),
        para(an.verbindlichkeiten_kommentar || ""),
        sp(),

        // ── C. GuV-Erläuterungen ──────────────────────────────────
        h1("C. Erlauterungen zur Gewinn- und Verlustrechnung"),
        divider(),

        h2("C.1 Umsatzerlöse"),
        sp(),
        dataTable(
          ["Segment / Region", `GJ ${year} TEUR`, `GJ ${py} TEUR`, "Veränderung %"],
          [
            ...segmente.map(s => [
              s.name,
              fmt(s.umsatz || 0),
              fmt(s.vorjahr_umsatz || 0),
              s.vorjahr_umsatz > 0 ? `${(((s.umsatz - s.vorjahr_umsatz) / s.vorjahr_umsatz) * 100).toFixed(1)} %` : "",
            ]),
            ["Gesamt Umsatzerlöse", fmt(umsatz), fmt(kennzahlen.vorjahr_umsatz || 0), kennzahlen.vorjahr_umsatz > 0 ? `${(((umsatz - kennzahlen.vorjahr_umsatz) / kennzahlen.vorjahr_umsatz) * 100).toFixed(1)} %` : ""],
          ],
          [3500, 1842, 1842, 1842]
        ),
        sp(),
        para(an.umsatz_kommentar || ""),
        sp(),

        h2("C.3 Personalaufwand"),
        sp(),
        dataTable(
          ["Position", `GJ ${year} TEUR`, `GJ ${py} TEUR`],
          [
            ["Löhne und Gehälter", fmt(G.loehne || 0), fmt(kennzahlen.vj_loehne || 0)],
            ["Soziale Abgaben und Altersversorgung", fmt(G.sozialabgaben || 0), fmt(kennzahlen.vj_sozialabgaben || 0)],
            ["Gesamt Personalaufwand", fmt(personalSumme), fmt(kennzahlen.vj_personalaufwand || 0)],
          ],
          [4513, 2257, 2256]
        ),
        sp(),
        para(an.personal_kommentar || ""),
        sp(),

        // ── D. Sonstige Pflichtangaben ─────────────────────────────
        h1("D. Sonstige Pflichtangaben"),
        divider(),

        h2("D.2 Derivative Finanzinstrumente (§ 285 Nr. 19 HGB)"),
        para(an.derivate_kommentar || ""),
        sp(),

        h2("D.3 Verbundene Unternehmen und Beteiligungen (§ 285 Nr. 11 HGB)"),
        sp(),
        ...(data.beteiligungen && data.beteiligungen.length > 0 ? [
          dataTable(
            ["Gesellschaft", "Sitz", "Anteil %", "EK TEUR", "Ergebnis TEUR"],
            data.beteiligungen.map(b => [b.name, b.sitz || "", b.anteil || "", fmt(b.eigenkapital || 0), fmt(b.ergebnis || 0)]),
            [2600, 1500, 800, 1563, 1563]
          ),
          sp(),
        ] : [para("Eine vollständige Aufstellung des Anteilsbesitzes wird gemäß § 285 Nr. 11 HGB im elektronischen Bundesanzeiger veröffentlicht.")]),
        sp(),

        h2("D.4 Organmitglieder (§ 285 Nr. 9, 10 HGB)"),
        h3("Vorstand"),
        sp(),
        dataTable(
          ["Name", "Funktion", "Bestellt bis"],
          (organe.vorstand || []).map(v => [v.name, v.funktion, v.bestellt_bis || ""]),
          [2800, 3400, 2826]
        ),
        sp(),
        ...(organe.aufsichtsrat && organe.aufsichtsrat.length > 0 ? [
          h3("Aufsichtsrat"),
          sp(),
          dataTable(
            ["Name", "Funktion"],
            organe.aufsichtsrat.map(a => [a.name, a.funktion || ""]),
            [5013, 4013]
          ),
          sp(),
        ] : []),

        h2("D.5 Abschlussprüferhonorar (§ 285 Nr. 17 HGB)"),
        sp(),
        dataTable(
          ["Leistungsart", `GJ ${year} TEUR`],
          [
            ["Abschlussprüfung", fmt(kennzahlen.prueferhonorar_pruefung || 0)],
            ["Andere Bestätigungsleistungen", fmt(kennzahlen.prueferhonorar_sonstig || 0)],
            ["Gesamt", fmt((kennzahlen.prueferhonorar_pruefung || 0) + (kennzahlen.prueferhonorar_sonstig || 0))],
          ],
          [5500, 3526]
        ),
        sp(),

        h2("D.6 Nahestehende Personen und Unternehmen (§ 285 Nr. 21 HGB)"),
        para(an.nahestehende_kommentar || ""),
        sp(),

        h2("D.7 Ergebnisverwendungsvorschlag (§ 170 Abs. 2 AktG)"),
        sp(),
        dataTable(
          ["Position", "Betrag TEUR"],
          [
            ["Jahresüberschuss " + year, fmt(jahresueber)],
            ["Gewinnvortrag aus dem Vorjahr", fmt(B.gewinnvortrag || 0)],
            ["Bilanzgewinn", fmt(bilanzgewinn)],
            ["Einstellung in andere Gewinnrücklagen", fmt(-einstellungRueckl)],
            [`Dividendenvorschlag (${(kennzahlen.dividende_je_aktie || 0).toFixed(2)} EUR/Aktie)`, fmt(dividendeGesamt)],
          ],
          [5500, 3526]
        ),
        sp(),

        h2("D.8 Entsprechenserklärung (§ 161 AktG)"),
        para(`Vorstand und Aufsichtsrat der ${company} haben die gemäß § 161 AktG vorgeschriebene Erklärung zum Deutschen Corporate Governance Kodex abgegeben und auf der Internetseite der Gesellschaft dauerhaft zugänglich gemacht.`),
        sp(),

        h2("D.9 Ereignisse nach dem Bilanzstichtag"),
        para(an.ereignisse_nach_stichtag || "Nach dem Bilanzstichtag sind keine wesentlichen Ereignisse eingetreten."),
        sp(2),

        // Bestaetigungsvermerk
        h1("E. Bestätigungsvermerk des Abschlussprufers"),
        divider(),
        para(`An die ${company}, ${stammdaten.sitz}`, { bold: true }),
        sp(),
        para("Prüfungsurteil", { bold: true, color: C.mid }),
        para(an.bestaetigung_pruefungsurteil || ""),
        sp(3),

        ...signatureBlock(stammdaten.sitz, year, organe.vorstand || []),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { renderAnhang };
