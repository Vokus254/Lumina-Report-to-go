import { z } from "zod";

export const VorstandsmitgliedSchema = z.object({
  name: z.string().default(""),
  funktion: z.string().default("Vorstandsvorsitzende/r (CEO)"),
  bestellt_bis: z.string().default(""),
});

export const AufsichtsratsmitgliedSchema = z.object({
  name: z.string().default(""),
  funktion: z.string().default(""),
});

export const BeteiligungSchema = z.object({
  name: z.string().default(""),
  sitz: z.string().default(""),
  anteil: z.string().default(""), // z.B. "51 %" – als String wegen Formatierung
  eigenkapital: z.number().default(0),
  ergebnis: z.number().default(0),
});

export const SegmentSchema = z.object({
  name: z.string().default(""),
  umsatz: z.number().nonnegative().default(0),
  vorjahr_umsatz: z.number().nonnegative().default(0),
});

export const OrganeSchema = z.object({
  vorstand: z.array(VorstandsmitgliedSchema).min(1),
  aufsichtsrat: z.array(AufsichtsratsmitgliedSchema).default([]),
});

export type Vorstandsmitglied = z.infer<typeof VorstandsmitgliedSchema>;
export type Aufsichtsratsmitglied = z.infer<typeof AufsichtsratsmitgliedSchema>;
export type Beteiligung = z.infer<typeof BeteiligungSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Organe = z.infer<typeof OrganeSchema>;
