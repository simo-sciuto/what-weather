/**
 * The one writer of the Atlas's address (the reviewer's I1, 2026-10-20). The point, the moment (`t`) and the layer
 * (`strato`) all go into the same query, through the router. Each change is made on the address as it will be once the
 * navigations already asked for have landed, not on `window.location`, which lags behind a navigation in flight: two
 * writers starting from the location would each undo the other's parameter.
 */
export type AddressWriter = {
  /** The query with `change` applied to the latest one asked for */
  next: (change: (params: URLSearchParams) => void) => string;
  /** The latest query asked for, or the location's when nothing is in flight */
  current: () => string;
  /** Forget what was asked for: the address is the location again (Back, Forward, a new page) */
  reset: () => void;
};

export function createAddressWriter(location: () => string): AddressWriter {
  let pending: string | null = null;
  return {
    next(change) {
      const params = new URLSearchParams(pending ?? location());
      change(params);
      pending = params.toString();
      return pending;
    },
    current: () => pending ?? location(),
    reset() {
      pending = null;
    },
  };
}
