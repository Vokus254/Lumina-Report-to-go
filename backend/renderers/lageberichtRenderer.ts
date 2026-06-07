import { Document, Packer, PageBreak, Paragraph } from 'docx';
import type { JahresabschlussData, AiTexts } from '../../packages/schema/src';
import {
  sp, divider, h1, h2, h3, para,
  titlePage, makeHeader, makeFooter, signatureBlock, kpiTable, dataTable,
  fmt, fmtT, fmtPct, fmtEur, calcMarge, calcWachstum, C,
} from '../utils/docxHelpers';

export async function renderLagebericht(data: JahresabschlussData, texts: AiTexts): Promise<Buffer> {
  const { stammdaten, guv, bilanz, kennzahlen, segmente, organe } = data;
  const lb = texts.lagebericht;
  const year = stammdaten.geschaeftsjahr;
  const company = stammdaten.firmenname;

  const ebitMarge      = calcMarge(guv.betriebsergebnis, guv.umsatzerloese);
  const ebitdaMarge    = calcMarge(guv.ebitda || (guv.betriebsergebnis + (guv.abschreibungen || 0)), guv.umsatzerloese);
  const umsatzWachstum = calcWachstum(guv.umsatzerloese, kennzahlen.vorjahr_umsatz);
  const ekQuote        = bilanz.bilanzsumme > 0 ? (bilanz.eigenkapital_gesamt / bilanz.bilanzsumme * 100) : 0;
  const nettoverschuldung = (bilanz.verbindlichkeiten_kreditinstitute || 0) + (bilanz.anleihen || 0) - (bilanz.liquide_mittel || 0);

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
      headers: { default: makeHeader(`${company.toUpperCase()}  |  Lagebericht für das Geschäftsjahr ${year}`) },
      footers: { default: makeFooter(`${company}  |  Lagebericht ${year}`) },
      children: [
        ...titlePage({ firmenname: company, sitz: stammdaten.sitz, docTitle: "Lagebericht", subtitle: `für das Geschäftsjahr ${year}`, year, legalNote: "Gemäß § 289 HGB und DRS 20" }),
        new Paragraph({ children: [new PageBreak()] }),

        h1("1. Grundlagen des Unternehmens"), divider(),
        h2("1.1 Unternehmensstruktur und Geschäftsmodell"),
        para(lb.geschaeftsmodell), sp(),
        h2("1.2 Ziele und Strategie"),
        para(lb.strategie), sp(),

        h1("2. Wirtschaftsbericht"), divider(),
        h2("2.1 Gesamtwirtschaftliche und branchenbezogene Rahmenbedingungen"),
        para(lb.gesamtwirtschaft), sp(),
        h2("2.2 Geschäftsverlauf"),
        para(lb.geschaeftsverlauf), sp(),

        para("Die nachfolgende Tabelle zeigt die wesentlichen Finanzkennzahlen im Ueberblick:"), sp(),
        kpiTable([
          ["Konzernumsatz",              fmtT(guv.umsatzerloese),          fmtT(kennzahlen.vorjahr_umsatz)],
          ["Umsatzwachstum (berichtet)", fmtPct(umsatzWachstum),           ""],
          ["EBITDA",                     fmtT(guv.ebitda),                  fmtT(kennzahlen.vorjahr_ebitda)],
          ["EBITDA-Marge",               fmtPct(ebitdaMarge),              ""],
          ["EBIT",                       fmtT(guv.betriebsergebnis),        fmtT(kennzahlen.vorjahr_ebit)],
          ["EBIT-Marge",                 fmtPct(ebitMarge),                ""],
          ["Jahresüberschuss",           fmtT(guv.jahresueberschuss),       fmtT(kennzahlen.vorjahr_jahresueber)],
          ["Ergebnis je Aktie",          fmtEur(kennzahlen.ergebnis_je_aktie), ""],
          ["Free Cashflow",              fmtT(kennzahlen.free_cashflow),   ""],
          ["Nettoverschuldung",          fmtT(nettoverschuldung),          ""],
          ["Eigenkapitalquote",          fmtPct(ekQuote),                  ""],
          ["Mitarbeiter (31.12.)",       fmt(kennzahlen.mitarbeiter),       fmt(kennzahlen.vorjahr_mitarbeiter)],
        ]), sp(),

        h2("2.3 Lage des Unternehmens"),
        h3("Ertragslage"), para(lb.ertragslage), sp(),
        h3("Finanzlage"), para(lb.finanzlage), sp(),
        h3("Vermögenslage"), para(lb.vermoegenslage), sp(),

        h1("3. Nachtragsbericht"), divider(),
        para(lb.nachtragsbericht || "Nach dem Bilanzstichtag sind keine wesentlichen berichtspflichtigen Ereignisse eingetreten."), sp(),

        h1("4. Prognose-, Chancen- und Risikobericht"), divider(),
        h2("4.1 Wesentliche Risiken"), para(lb.risiken), sp(),
        h2("4.2 Chancen"), para(lb.chancen), sp(),
        h2("4.3 Prognose"), para(lb.prognose), sp(),

        h1("5. Segmentinformationen"), divider(),
        para(`Die Gesellschaft gliedert sich in ${segmente.length} operative Segmente. Die folgende Tabelle zeigt die Umsatzaufteilung:`), sp(),
        ...(segmente.length > 0 ? [
          dataTable(
            ["Segment", `GJ ${year} TEUR`, "Anteil %"],
            segmente.map(s => [
              s.name,
              fmt(s.umsatz),
              fmtPct(guv.umsatzerloese > 0 ? (s.umsatz / guv.umsatzerloese * 100) : 0),
            ]),
            [4513, 2257, 2256]
          ),
        ] : []),
        sp(),

        ...signatureBlock(stammdaten.sitz, year, organe.vorstand || []),
      ],
    }],
  });

  return Packer.toBuffer(doc) as unknown as Buffer;
}
