const {
  Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, TabStopType, SimpleField,
} = require('docx');

// ── Palette ────────────────────────────────────────────────────────
const C = {
  blue:    "1F3864",
  mid:     "2E75B6",
  lblue:   "D6E4F0",
  lblue2:  "EBF3FB",
  gray:    "595959",
  lgray:   "F2F2F2",
  dkgray:  "333333",
  white:   "FFFFFF",
};

// ── Borders ────────────────────────────────────────────────────────
const bdr  = (color = "CCCCCC", size = 1) => ({ style: BorderStyle.SINGLE, size, color });
const allB = { top: bdr(), bottom: bdr(), left: bdr(), right: bdr() };
const noB  = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noAllB = { top: noB, bottom: noB, left: noB, right: noB };
const cm   = { top: 80, bottom: 80, left: 140, right: 140 };
const cmSm = { top: 60, bottom: 60, left: 140, right: 140 };

// ── Basic paragraph constructors ──────────────────────────────────
function sp(n = 1) {
  return new Paragraph({ spacing: { before: 0, after: n * 60 }, children: [new TextRun("")] });
}

function divider() {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.mid, space: 1 } },
    children: [new TextRun("")],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 520, after: 180 },
    children: [new TextRun({ text, bold: true, size: 36, color: C.blue, font: "Arial" })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 340, after: 140 },
    children: [new TextRun({ text, bold: true, size: 28, color: C.mid, font: "Arial" })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 260, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: C.gray, font: "Arial" })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 140 },
    alignment: AlignmentType.BOTH,
    children: [new TextRun({ text, size: 22, font: "Arial", color: "000000", ...opts })],
  });
}

function note(text) {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    indent: { left: 200 },
    children: [new TextRun({ text, size: 18, font: "Arial", color: C.gray, italics: true })],
  });
}

function titlePage({ firmenname, sitz, docTitle, subtitle, year, legalNote }) {
  return [
    new Paragraph({ spacing: { before: 1400, after: 0 }, children: [new TextRun("")] }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: firmenname.toUpperCase(), size: 64, bold: true, color: C.blue, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 0, after: 360 },
      children: [new TextRun({ text: sitz, size: 28, color: C.gray, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 8, color: C.mid }, bottom: { style: BorderStyle.SINGLE, size: 8, color: C.mid } },
      spacing: { before: 100, after: 100 },
      children: [new TextRun({ text: docTitle.toUpperCase(), size: 48, bold: true, color: C.mid, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 },
      children: [new TextRun({ text: subtitle, size: 26, color: C.gray, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 0, after: 300 },
      children: [new TextRun({ text: `1. Januar ${year} - 31. Dezember ${year}`, size: 30, bold: true, color: C.blue, font: "Arial" })],
    }),
    ...(legalNote ? [new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: legalNote, size: 20, color: C.gray, font: "Arial", italics: true })],
    })] : []),
  ];
}

function makeHeader(label) {
  return new Header({
    children: [new Paragraph({
      spacing: { before: 0, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.mid, space: 4 } },
      children: [new TextRun({ text: label, size: 18, color: C.gray, font: "Arial" })],
    })],
  });
}

function makeFooter(label) {
  return new Footer({
    children: [new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.mid, space: 4 } },
      tabStops: [{ type: TabStopType.RIGHT, position: 9026 }],
      children: [
        new TextRun({ text: label, size: 16, color: C.gray, font: "Arial" }),
        new TextRun({ text: "\t", size: 16, font: "Arial" }),
        new TextRun({ text: "Seite ", size: 16, color: C.gray, font: "Arial" }),
        new SimpleField("PAGE"),
      ],
    })],
  });
}

function signatureBlock(sitz, year, persons) {
  const month = "März";
  return [
    sp(3),
    para(`${sitz}, ${month} ${parseInt(year) + 1}`, { italics: true, color: C.gray }),
    sp(),
    para("Der Vorstand", { bold: true }),
    sp(3),
    ...persons.flatMap(person => [
      new Paragraph({
        spacing: { before: 160, after: 40 },
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: "999999", space: 1 } },
        children: [new TextRun({ text: `${person.name}  |  ${person.funktion}`, size: 22, font: "Arial" })],
      }),
      sp(),
    ]),
  ];
}

// ── Generic financial table (header row + data rows) ──────────────
function dataTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      // Header
      new TableRow({
        children: headers.map((h, i) => new TableCell({
          borders: allB,
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { fill: C.blue, type: ShadingType.CLEAR },
          margins: cmSm,
          children: [new Paragraph({
            alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
            children: [new TextRun({ text: h || "", size: 20, bold: true, color: "FFFFFF", font: "Arial" })],
          })],
        })),
      }),
      // Data rows
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => new TableCell({
          borders: allB,
          width: { size: colWidths[ci], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? C.lblue : C.white, type: ShadingType.CLEAR },
          margins: cmSm,
          children: [new Paragraph({
            alignment: ci === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
            children: [new TextRun({ text: String(cell ?? ""), size: 20, font: "Arial", color: "000000" })],
          })],
        })),
      })),
    ],
  });
}

// ── Bilanz-style table (with typed rows: header/group/subgroup/item/subitem/total/grandtotal/spacer) ──
function bilanzTable(rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  let altIdx = 0;
  const tableRows = [];

  for (const row of rows) {
    const { type, cols } = row;

    if (type === 'spacer') {
      tableRows.push(new TableRow({
        children: colWidths.map((_, i) => new TableCell({
          borders: noAllB,
          width: { size: colWidths[i], type: WidthType.DXA },
          margins: { top: 15, bottom: 15, left: 0, right: 0 },
          children: [new Paragraph({ children: [new TextRun("")] })],
        })),
      }));
      continue;
    }

    const configs = {
      header:     { fill: C.blue,   textColor: "FFFFFF", bold: true,  indent: 0     },
      group:      { fill: C.mid,    textColor: "FFFFFF", bold: true,  indent: 0     },
      subgroup:   { fill: C.lblue,  textColor: C.dkgray, bold: true,  indent: 200   },
      total:      { fill: C.lblue2, textColor: C.blue,   bold: true,  indent: 0,    topBorder: true },
      grandtotal: { fill: C.blue,   textColor: "FFFFFF", bold: true,  indent: 0     },
      item:       { fill: null,     textColor: "000000", bold: false, indent: 0     },
      subitem:    { fill: null,     textColor: "000000", bold: false, indent: 360   },
      subsubitem: { fill: null,     textColor: "000000", bold: false, indent: 600   },
    };

    const cfg = configs[type] || configs.item;
    const fill = cfg.fill || (altIdx % 2 === 0 ? C.white : C.lgray);
    if (!cfg.fill) altIdx++;

    const rowBorders = cfg.topBorder
      ? { top: bdr(C.mid, 4), bottom: bdr(C.mid, 4), left: bdr(), right: bdr() }
      : allB;

    tableRows.push(new TableRow({
      children: (cols || []).map((cell, ci) => new TableCell({
        borders: rowBorders,
        width: { size: colWidths[ci], type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR },
        margins: cmSm,
        children: [new Paragraph({
          alignment: ci === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
          indent: ci === 0 && cfg.indent ? { left: cfg.indent } : undefined,
          children: [new TextRun({ text: String(cell ?? ""), size: 20, font: "Arial", bold: cfg.bold, color: cfg.textColor })],
        })],
      })),
    }));
  }

  return new Table({ width: { size: totalW, type: WidthType.DXA }, columnWidths: colWidths, rows: tableRows });
}

// ── KPI summary table (2-col: label | value | prev) ───────────────
function kpiTable(rows) {
  const widths = [4513, 2257, 2256];
  return dataTable(["Kennzahl", "GJ Aktuell", "GJ Vorjahr"], rows, widths);
}

// ── Number formatting helpers ─────────────────────────────────────
function fmt(n, decimals = 0) {
  if (n == null || n === "") return "";
  return Number(n).toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtT(n) { return fmt(n) + " TEUR"; }
function fmtPct(n, decimals = 1) { return fmt(n, decimals) + " %"; }
function fmtEur(n, decimals = 2) { return fmt(n, decimals) + " EUR"; }

function calcMarge(ebit, umsatz) {
  if (!umsatz) return 0;
  return ((ebit / umsatz) * 100);
}

function calcWachstum(current, prior) {
  if (!prior) return 0;
  return (((current - prior) / prior) * 100);
}

module.exports = {
  C, allB, noAllB, cm, cmSm, bdr,
  sp, divider, h1, h2, h3, para, note,
  titlePage, makeHeader, makeFooter, signatureBlock,
  dataTable, bilanzTable, kpiTable,
  fmt, fmtT, fmtPct, fmtEur, calcMarge, calcWachstum,
};
