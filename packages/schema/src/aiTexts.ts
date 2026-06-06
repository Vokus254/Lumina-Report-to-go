import { z } from "zod";

/**
 * Schema für Claude-generierte Freitexte.
 *
 * ARCHITEKTUR-CONSTRAINT: Die KI formuliert NUR Texte für Abschnitte,
 * die durch das Schema und die Regel-Engine als erforderlich bestimmt wurden.
 * Die KI entscheidet NICHT, welche Pflichtangaben existieren.
 */

const optText = z.string().default(""); // optionaler Freitext-Block

export const LageberichtTexteSchema = z.object({
  geschaeftsmodell: optText,
  strategie: optText,
  gesamtwirtschaft: optText,
  geschaeftsverlauf: optText,
  ertragslage: optText,
  finanzlage: optText,
  vermoegenslage: optText,
  nachtragsbericht: optText,
  risiken: optText,
  chancen: optText,
  prognose: optText,
});

export const AnhangTexteSchema = z.object({
  rechtliche_grundlagen: optText,
  bilanzierungsgrundsaetze_intro: optText,
  bewertung_immaterielle: optText,
  bewertung_sachanlagen: optText,
  bewertung_vorraete: optText,
  bewertung_forderungen: optText,
  bewertung_rueckstellungen: optText,
  vorraete_kommentar: optText,
  forderungen_kommentar: optText,
  eigenkapital_kommentar: optText,
  rueckstellungen_kommentar: optText,
  verbindlichkeiten_kommentar: optText,
  umsatz_kommentar: optText,
  personal_kommentar: optText,
  derivate_kommentar: optText,
  nahestehende_kommentar: optText,
  ereignisse_nach_stichtag: optText,
  bestaetigung_pruefungsurteil: optText,
});

export const AiTextsSchema = z.object({
  lagebericht: LageberichtTexteSchema,
  anhang: AnhangTexteSchema,
});

export type LageberichtTexte = z.infer<typeof LageberichtTexteSchema>;
export type AnhangTexte = z.infer<typeof AnhangTexteSchema>;
export type AiTexts = z.infer<typeof AiTextsSchema>;
