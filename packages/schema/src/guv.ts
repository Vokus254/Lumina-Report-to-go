import { z } from "zod";

/** Alle Beträge in TEUR. Aufwendungen werden als positive Zahlen eingegeben. */
export const GuvSchema = z.object({
  // Erträge
  umsatzerloese: z.number().default(0),
  bestandsveraenderung: z.number().default(0), // kann negativ sein
  eigenleistungen: z.number().nonnegative().default(0),
  sonstige_ertraege: z.number().nonnegative().default(0),
  // Materialaufwand (positiv = Aufwand)
  material_roh: z.number().nonnegative().default(0),
  material_dienst: z.number().nonnegative().default(0),
  // Personalaufwand
  loehne: z.number().nonnegative().default(0),
  sozialabgaben: z.number().nonnegative().default(0),
  // Weitere Aufwendungen
  abschreibungen: z.number().nonnegative().default(0),
  sonstige_aufwendungen: z.number().nonnegative().default(0),
  // Finanzergebnis
  beteiligungsertraege: z.number().nonnegative().default(0),
  zinsertraege: z.number().nonnegative().default(0),
  abschr_finanzanlagen: z.number().nonnegative().default(0),
  zinsaufwendungen: z.number().nonnegative().default(0),
  // Steuern
  steuern_ertrag: z.number().nonnegative().default(0),
  sonstige_steuern: z.number().nonnegative().default(0),
  // Abgeleitete Felder (werden im Frontend berechnet und mitgesendet)
  betriebsergebnis: z.number().default(0),
  ebitda: z.number().default(0),
  jahresueberschuss: z.number().default(0),
});

export type Guv = z.infer<typeof GuvSchema>;
