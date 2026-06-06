import { z } from "zod";
import { StammdatenSchema } from "./stammdaten";
import { GuvSchema } from "./guv";
import { BilanzSchema } from "./bilanz";
import { KennzahlenSchema } from "./kennzahlen";
import { OrganeSchema, SegmentSchema, BeteiligungSchema } from "./organe";

/**
 * Root-Schema des gesamten Jahresabschluss-Datensatzes.
 * Dieses Schema ist die einzige Quelle der Wahrheit für alle
 * Feldnamen — Frontend, Backend und Renderer leiten daraus ihre Typen ab.
 */
export const JahresabschlussSchema = z.object({
  stammdaten: StammdatenSchema,
  segmente: z.array(SegmentSchema).min(1).default([
    { name: "", umsatz: 0, vorjahr_umsatz: 0 },
  ]),
  guv: GuvSchema,
  bilanz: BilanzSchema,
  kennzahlen: KennzahlenSchema,
  organe: OrganeSchema,
  beteiligungen: z.array(BeteiligungSchema).default([]),
});

export type JahresabschlussData = z.infer<typeof JahresabschlussSchema>;

/**
 * Partial-Schema für Import/Merge-Operationen (z.B. Excel-Import).
 * Alle Felder optional — fehlende werden aus DEFAULT_DATA ergänzt.
 */
export const JahresabschlussPartialSchema = JahresabschlussSchema.deepPartial();
export type JahresabschlussPartial = z.infer<typeof JahresabschlussPartialSchema>;

/**
 * Default-Werte für einen leeren Jahresabschluss.
 * Ersetzt defaultData.js im Frontend (wird von dort importiert).
 */
export const DEFAULT_JAHRESABSCHLUSS: JahresabschlussData =
  JahresabschlussSchema.parse({
    stammdaten: {
      geschaeftsjahr: new Date().getFullYear().toString(),
    },
    segmente: [{ name: "", umsatz: 0, vorjahr_umsatz: 0 }],
    guv: {},
    bilanz: {},
    kennzahlen: {},
    organe: {
      vorstand: [
        { name: "", funktion: "Vorstandsvorsitzende/r (CEO)", bestellt_bis: "" },
      ],
      aufsichtsrat: [{ name: "", funktion: "Aufsichtsratsvorsitzende/r" }],
    },
    beteiligungen: [],
  });
