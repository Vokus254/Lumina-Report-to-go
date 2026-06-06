import { describe, it, expect } from "vitest";
import {
  JahresabschlussSchema,
  DEFAULT_JAHRESABSCHLUSS,
  AiTextsSchema,
  BilanzSchema,
  GuvSchema,
  KennzahlenSchema,
} from "../index";
import { StammdatenGenerateSchema } from "../stammdaten";

describe("JahresabschlussSchema", () => {
  it("parst DEFAULT_JAHRESABSCHLUSS ohne Fehler", () => {
    const result = JahresabschlussSchema.safeParse(DEFAULT_JAHRESABSCHLUSS);
    expect(result.success).toBe(true);
  });

  it("lehnt leeres Objekt ab (organe.vorstand.min(1) nicht erfüllt)", () => {
    // Intentional: mindestens 1 Vorstandsmitglied ist immer erforderlich
    const result = JahresabschlussSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("Generate-Schema lehnt leeren Firmennamen ab", () => {
    const result = StammdatenGenerateSchema.safeParse({ geschaeftsjahr: "2025" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("firmenname");
    }
  });

  it("akzeptiert valides Stammdaten-Minimum", () => {
    const result = JahresabschlussSchema.safeParse({
      stammdaten: { firmenname: "Test AG", sitz: "Berlin", geschaeftsjahr: "2025" },
      segmente: [{ name: "Segment 1", umsatz: 1000, vorjahr_umsatz: 900 }],
      guv: {},
      bilanz: {},
      kennzahlen: {},
      organe: { vorstand: [{ name: "Max Mustermann", funktion: "CEO" }] },
    });
    expect(result.success).toBe(true);
  });

  it("lehnt ungültiges Geschäftsjahr ab", () => {
    const result = JahresabschlussSchema.safeParse({
      stammdaten: { firmenname: "X", sitz: "Y", geschaeftsjahr: "25" },
      segmente: [{ name: "S", umsatz: 0, vorjahr_umsatz: 0 }],
      guv: {},
      bilanz: {},
      kennzahlen: {},
      organe: { vorstand: [{ name: "A", funktion: "CEO" }] },
    });
    expect(result.success).toBe(false);
  });
});

describe("BilanzSchema", () => {
  it("alle VJ-Felder sind im Schema definiert", () => {
    const schema = BilanzSchema.shape;
    const vjFelder = [
      "vj_immat_vw", "vj_sachanlagen", "vj_finanzanlagen", "vj_anlagevermoegen",
      "vj_vorraete", "vj_vorr_rhb", "vj_vorr_unfertig", "vj_vorr_fertig",
      "vj_vorr_anzahlungen", "vj_forderungen", "vj_wertpapiere", "vj_liquide_mittel",
      "vj_umlaufvermoegen", "vj_bilanzsumme",
      "vj_ez_kapital", "vj_kapruecklage", "vj_gesetzliche_ruecklage",
      "vj_andere_gewinnrueckl", "vj_gewinnruecklagen", "vj_bilanzgewinn",
      "vj_eigenkapital", "vj_pensionsrueck", "vj_steuerrueck", "vj_sonstige_rueck",
      "vj_rueckstellungen", "vj_anleihen", "vj_verb_kreditinst", "vj_erh_anzahlungen",
      "vj_verb_llg", "vj_verb_vbu", "vj_sonst_verb", "vj_verbindlichkeiten",
      "vj_passiver_rao", "vj_aktiver_rao", "vj_aktive_latente",
    ] as const;
    for (const feld of vjFelder) {
      expect(schema).toHaveProperty(feld);
    }
  });

  it("sonderposten ist im Schema (§ 273 HGB)", () => {
    expect(BilanzSchema.shape).toHaveProperty("sonderposten");
  });
});

describe("GuvSchema", () => {
  it("Pflichtaufwandsfelder defaulten auf 0", () => {
    const g = GuvSchema.parse({});
    expect(g.loehne).toBe(0);
    expect(g.sozialabgaben).toBe(0);
    expect(g.abschreibungen).toBe(0);
  });
});

describe("KennzahlenSchema", () => {
  it("vj_loehne und vj_sozialabgaben sind definiert", () => {
    const schema = KennzahlenSchema.shape;
    expect(schema).toHaveProperty("vj_loehne");
    expect(schema).toHaveProperty("vj_sozialabgaben");
  });
});

describe("AiTextsSchema", () => {
  it("parst validen Claude-Output", () => {
    const validOutput = {
      lagebericht: {
        geschaeftsmodell: "Die Gesellschaft ist tätig...",
        prognose: "Für das kommende Geschäftsjahr...",
      },
      anhang: {
        rechtliche_grundlagen: "Die Gesellschaft wurde...",
      },
    };
    const result = AiTextsSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("fehlende Felder werden mit leerem String aufgefüllt", () => {
    const result = AiTextsSchema.parse({ lagebericht: {}, anhang: {} });
    expect(result.lagebericht.geschaeftsmodell).toBe("");
    expect(result.anhang.rechtliche_grundlagen).toBe("");
  });
});
