import { z } from "zod";

/** Storage-Schema: alle Felder mit Defaults (auch Pflichtfelder leer erlaubt). */
export const StammdatenSchema = z.object({
  firmenname: z.string().default(""),
  rechtsform: z.string().default("AG"),
  sitz: z.string().default(""),
  handelsregister: z.string().default(""),
  boerse: z.string().default("Prime Standard, Frankfurt"),
  isin: z.string().default(""),
  ticker: z.string().default(""),
  geschaeftsjahr: z.string().regex(/^\d{4}$/, "Muss vierstellige Jahreszahl sein"),
  branche: z.string().default(""),
  anzahl_aktien: z.number().int().nonnegative().default(0),
  abschlussprufer: z.string().default(""),
  gruendungsjahr: z.string().default(""),
  mitarbeiter_standorte: z.string().default(""),
});

export type Stammdaten = z.infer<typeof StammdatenSchema>;

/**
 * Validierungs-Schema für die API (POST /api/generate).
 * Erzwingt Pflichtfelder — wird NUR beim Generieren verwendet.
 */
export const StammdatenGenerateSchema = StammdatenSchema.extend({
  firmenname: z.string().min(1, "Firmenname ist Pflicht"),
  sitz: z.string().min(1, "Sitz ist Pflicht"),
  geschaeftsjahr: z.string().regex(/^\d{4}$/, "Muss vierstellige Jahreszahl sein"),
});
