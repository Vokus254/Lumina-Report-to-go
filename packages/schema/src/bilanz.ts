import { z } from "zod";

const nn = z.number().default(0); // shorthand: number, default 0

/** Bilanz gemäß § 266 HGB. Alle Beträge in TEUR. */
export const BilanzSchema = z.object({
  // ── AKTIVA – Anlagevermögen ──────────────────────────────
  immat_lizenzen: nn,
  immat_selbst: nn,
  immat_anzahlungen: nn,
  immat_vw: nn, // Summe immat. Vermögenswerte
  sach_gebaeude: nn,
  sach_maschinen: nn,
  sach_ausstattung: nn,
  sach_anbau: nn,
  sachanlagen: nn, // Summe
  fin_anteilsvbu: nn,
  fin_ausleihvbu: nn,
  fin_beteiligungen: nn,
  finanzanlagen: nn, // Summe
  // ── AKTIVA – Umlaufvermögen ──────────────────────────────
  vorr_rhb: nn,
  vorr_unfertig: nn,
  vorr_fertig: nn,
  vorr_anzahlungen: nn,
  vorraete: nn, // Summe
  ford_llg: nn,
  ford_llg_gt1y: nn, // davon > 1 Jahr (Anhang B.3)
  ford_vbu: nn,
  ford_vbu_gt1y: nn,
  ford_sonstige: nn,
  ford_sonstige_gt1y: nn,
  ford_gesamt_gt1y: nn,
  forderungen_gesamt: nn, // Summe
  wertpapiere_umlauf: nn,
  liquide_mittel: nn,
  aktiver_rao: nn,
  aktive_latente_steuern: nn,
  bilanzsumme: nn,
  // ── PASSIVA – Eigenkapital ───────────────────────────────
  gezeichnetes_kapital: nn,
  kapitalruecklage: nn,
  gesetzliche_ruecklage: nn,
  andere_gewinnruecklagen: nn,
  bilanzgewinn: nn,
  gewinnvortrag: nn,
  einstellung_ruecklagen: nn,
  eigenkapital_gesamt: nn,
  sonderposten: nn, // § 273 HGB
  // ── PASSIVA – Rückstellungen ─────────────────────────────
  pensionsrueckstellungen: nn,
  steuerrueckstellungen: nn,
  sonstige_rueckstellungen: nn,
  // Bewegungsspiegel (Anhang B.5)
  zugang_pensionsrueck: nn,
  abgang_pensionsrueck: nn,
  zugang_steuerrueck: nn,
  abgang_steuerrueck: nn,
  zugang_sonstige_rueck: nn,
  abgang_sonstige_rueck: nn,
  // ── PASSIVA – Verbindlichkeiten ──────────────────────────
  anleihen: nn,
  anleihen_lt1y: nn,
  anleihen_1to5y: nn,
  anleihen_gt5y: nn,
  verbindlichkeiten_kreditinstitute: nn,
  verb_ki_lt1y: nn,
  verb_ki_1to5y: nn,
  verb_ki_gt5y: nn,
  erhaltene_anzahlungen: nn,
  verbindlichkeiten_llg: nn,
  verbindlichkeiten_vbu: nn,
  sonstige_verbindlichkeiten: nn,
  sonst_verb_lt1y: nn,
  sonst_verb_1to5y: nn,
  passiver_rao: nn,
  // ── Vorjahreswerte Aktiva ────────────────────────────────
  // Sub-Items Immaterielles Vermögen
  vj_immat_lizenzen: nn,
  vj_immat_selbst: nn,
  vj_immat_anzahlungen: nn,
  vj_immat_vw: nn,
  // Sub-Items Sachanlagen
  vj_sach_gebaeude: nn,
  vj_sach_maschinen: nn,
  vj_sach_ausstattung: nn,
  vj_sach_anbau: nn,
  vj_sachanlagen: nn,
  // Sub-Items Finanzanlagen
  vj_fin_anteilsvbu: nn,
  vj_fin_ausleihvbu: nn,
  vj_fin_beteiligungen: nn,
  vj_finanzanlagen: nn,
  vj_anlagevermoegen: nn,
  vj_vorraete: nn,
  vj_vorr_rhb: nn,
  vj_vorr_unfertig: nn,
  vj_vorr_fertig: nn,
  vj_vorr_anzahlungen: nn,
  // Sub-Items Forderungen
  vj_ford_llg: nn,
  vj_ford_vbu: nn,
  vj_ford_sonstige: nn,
  vj_forderungen: nn,
  vj_wertpapiere: nn,
  vj_liquide_mittel: nn,
  vj_umlaufvermoegen: nn,
  vj_aktiver_rao: nn,
  vj_aktive_latente: nn,
  vj_bilanzsumme: nn,
  // ── Vorjahreswerte Passiva ───────────────────────────────
  vj_ez_kapital: nn,
  vj_kapruecklage: nn,
  vj_gesetzliche_ruecklage: nn,
  vj_andere_gewinnrueckl: nn,
  vj_gewinnruecklagen: nn,
  vj_bilanzgewinn: nn,
  vj_eigenkapital: nn,
  vj_pensionsrueck: nn,
  vj_steuerrueck: nn,
  vj_sonstige_rueck: nn,
  vj_rueckstellungen: nn,
  vj_anleihen: nn,
  vj_verb_kreditinst: nn,
  vj_erh_anzahlungen: nn,
  vj_verb_llg: nn,
  vj_verb_vbu: nn,
  vj_sonst_verb: nn,
  vj_verbindlichkeiten: nn,
  vj_passiver_rao: nn,
});

export type Bilanz = z.infer<typeof BilanzSchema>;
