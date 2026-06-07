import type { JahresabschlussData } from '../types';

export const DEFAULT_DATA: JahresabschlussData = {
  stammdaten: {
    firmenname: '',
    rechtsform: '',
    sitz: '',
    handelsregister: '',
    gruendungsjahr: '',
    geschaeftsjahr: new Date().getFullYear().toString(),
    branche: '',
    mitarbeiter_standorte: '',
    boerse: '',
    isin: '',
    ticker: '',
    anzahl_aktien: 0,
    abschlussprufer: '',
  },
  segmente: [{ name: '', umsatz: 0, vorjahr_umsatz: 0 }],
  guv: {},
  bilanz: {},
  kennzahlen: {},
  organe: {
    vorstand: [{ name: '', funktion: 'Vorstandsvorsitzende/r (CEO)', bestellt_bis: '' }],
    aufsichtsrat: [{ name: '', funktion: 'Aufsichtsratsvorsitzende/r' }],
  },
  beteiligungen: [],
} as unknown as JahresabschlussData;
