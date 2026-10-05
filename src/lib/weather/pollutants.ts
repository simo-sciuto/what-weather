import type { Pollutants } from "./types";

/**
 * What each pollutant is and why it matters, for the explanations behind the
 * pollutant rows. Guideline values are the WHO global air quality guidelines
 * (2021); they are averages over a day (8 hours for ozone), so they frame an
 * hourly reading rather than judge it.
 */

export type PollutantInfo = {
  /** What it is and where it comes from */
  what: string;
  /** Why it is harmful */
  harm: string;
  /** WHO guideline, as a phrase */
  guideline: string;
};

export const POLLUTANT_INFO: Record<keyof Pollutants, PollutantInfo> = {
  pm2_5: {
    what: "Particelle con diametro fino a 2,5 micrometri, prodotte da traffico, riscaldamento (soprattutto legna e pellet), industria e reazioni chimiche tra altri inquinanti nell’aria.",
    harm: "Sono così piccole da arrivare in profondità nei polmoni e passare nel sangue. L’esposizione prolungata aumenta il rischio di malattie cardiache, ictus, malattie respiratorie e tumore del polmone.",
    guideline: "15 µg/m³ come media su 24 ore, 5 µg/m³ come media annua",
  },
  pm10: {
    what: "Particelle con diametro fino a 10 micrometri: polveri da traffico (anche da freni e pneumatici), cantieri, riscaldamento, oltre a sabbia e sale marino.",
    harm: "Si fermano soprattutto nelle vie respiratorie: le irritano, peggiorano asma e bronchite e, con esposizioni ripetute, aumentano i disturbi respiratori e cardiovascolari.",
    guideline: "45 µg/m³ come media su 24 ore, 15 µg/m³ come media annua",
  },
  o3: {
    what: "L’ozono vicino al suolo non viene emesso direttamente: si forma con la luce del sole a partire da ossidi di azoto e composti organici volatili. Per questo i picchi arrivano nei pomeriggi caldi e soleggiati.",
    harm: "Irrita occhi e vie respiratorie, riduce la funzione polmonare e scatena attacchi d’asma. Chi fa attività fisica all’aperto nelle ore di picco ne respira di più.",
    guideline: "100 µg/m³ come media su 8 ore",
  },
  no2: {
    what: "Gas prodotto dalla combustione ad alta temperatura, soprattutto dai motori diesel e dal riscaldamento. È più concentrato vicino alle strade trafficate.",
    harm: "Infiamma le vie respiratorie, rende più vulnerabili alle infezioni e peggiora l’asma, specie nei bambini. Contribuisce anche a formare ozono e particolato.",
    guideline: "25 µg/m³ come media su 24 ore, 10 µg/m³ come media annua",
  },
  so2: {
    what: "Gas prodotto bruciando combustibili che contengono zolfo, come carbone e olio combustibile: centrali, industria e navi.",
    harm: "Irrita occhi e vie respiratorie; nelle persone con asma può restringere i bronchi anche dopo pochi minuti di esposizione.",
    guideline: "40 µg/m³ come media su 24 ore",
  },
  co: {
    what: "Gas incolore e inodore prodotto dalla combustione incompleta: traffico, stufe, caldaie e camini.",
    harm: "Si lega all’emoglobina al posto dell’ossigeno e ne riduce il trasporto ai tessuti. Ai livelli tipici all’aperto il rischio riguarda soprattutto chi ha malattie cardiache.",
    guideline: "4 mg/m³ (4.000 µg/m³) come media su 24 ore",
  },
};

/** Official references, shared by every pollutant. */
export const POLLUTANT_SOURCES = [
  {
    label: "OMS · Linee guida globali sulla qualità dell’aria (2021)",
    href: "https://www.who.int/publications/i/item/9789240034228",
  },
  {
    label: "OMS · Inquinamento dell’aria esterna e salute",
    href: "https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health",
  },
  {
    label: "Agenzia europea dell’ambiente · Inquinamento atmosferico",
    href: "https://www.eea.europa.eu/en/topics/in-depth/air-pollution",
  },
] as const;
