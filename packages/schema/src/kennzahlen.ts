import { z } from "zod";

/** Kennzahlen und Vorjahreswerte für GuV-Vergleichsspalte. */
export const KennzahlenSchema = z.object({
  // Vorjahreswerte GuV (für Vergleichsspalte)
  vorjahr_umsatz: z.number().default(0),
  vorjahr_ebit: z.number().default(0),
  vorjahr_ebitda: z.number().default(0),
  vorjahr_jahresueber: z.number().default(0),
  // Weitere Vorjahres-Einzelpositionen
  vj_materialaufwand: z.number().nonnegative().default(0),
  vj_personalaufwand: z.number().nonnegative().default(0),
  vj_loehne: z.number().nonnegative().default(0),
  vj_sozialabgaben: z.number().nonnegative().default(0),
  vj_abschreibungen: z.number().nonnegative().default(0),
  vj_sonstige_ertraege: z.number().nonnegative().default(0),
  vj_zinsaufwand: z.number().nonnegative().default(0),
  vorjahr_bilanzsumme: z.number().nonnegative().default(0),
  // Mitarbeiter
  mitarbeiter: z.number().int().nonnegative().default(0),
  vorjahr_mitarbeiter: z.number().int().nonnegative().default(0),
  // Kapitalmarkt
  ergebnis_je_aktie: z.number().default(0),
  free_cashflow: z.number().default(0),
  dividende_je_aktie: z.number().nonnegative().default(0),
  // Prüferhonorar § 285 Nr. 17 HGB
  prueferhonorar_pruefung: z.number().nonnegative().default(0),
  prueferhonorar_sonstig: z.number().nonnegative().default(0),
});

export type Kennzahlen = z.infer<typeof KennzahlenSchema>;
