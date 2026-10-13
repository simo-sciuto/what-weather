/**
 * What can stop a poster from being drawn (WTH-235), told apart so the viewer gets a sentence that fits the cause and
 * a retry only where a retry can help. The messages are Italian and say nothing technical: no token, no URL, no error
 * text reaches the page.
 */

export type PosterFailure =
  /** The map's data could not be reached (network, the map service down or slow to answer at the start) */
  | "map-unreachable"
  /** The map service refused the request (the token is not allowed here): a retry does not help */
  | "map-unauthorized"
  /** The browser has no WebGL: the map cannot be drawn on this device at all */
  | "webgl"
  /** The map took longer than its limit to finish drawing */
  | "timeout"
  /** The picture could not be made into a file (canvas, encoding) */
  | "export";

/** A failure the poster knows the cause of; anything else is an export failure (the last step of the pipeline) */
export class PosterError extends Error {
  constructor(
    readonly failure: PosterFailure,
    options?: { cause?: unknown },
  ) {
    super(failure, options);
    this.name = "PosterError";
  }
}

export const POSTER_MESSAGES: Record<PosterFailure, { message: string; retry: boolean }> = {
  "map-unreachable": { message: "La mappa non si carica. Controlla la connessione e riprova.", retry: true },
  "map-unauthorized": { message: "La mappa non è disponibile in questa versione del sito.", retry: false },
  webgl: { message: "Questo browser non può disegnare la mappa. Prova con un browser aggiornato o con un dispositivo con grafica accelerata.", retry: false },
  timeout: { message: "La mappa ha impiegato troppo tempo. Riprova.", retry: true },
  export: { message: "Non sono riuscito a creare il poster. Riprova.", retry: true },
};

/**
 * The cause of an error raised while the map is drawn. An authorisation refusal is recognised by its HTTP status
 * (Mapbox's errors carry one); a network or server failure, or anything else the map raised, is "unreachable".
 */
export function mapFailureOf(error: unknown): PosterFailure {
  if (error instanceof PosterError) return error.failure;
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 401 || status === 403) return "map-unauthorized";
  return "map-unreachable";
}

/** The cause of any error from the poster's pipeline: the map's own causes are kept, all else is the export */
export function posterFailureOf(error: unknown): PosterFailure {
  if (error instanceof PosterError) return error.failure;
  return "export";
}

/**
 * Whether the browser can draw with WebGL, which the map needs. The canvas is injected so the check can be tested
 * without a browser.
 */
export function webglAvailable(createCanvas: () => { getContext(kind: string): unknown } = () => document.createElement("canvas")): boolean {
  const canvas = createCanvas();
  return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
}
