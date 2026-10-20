"use client";

import { useMoment } from "./TimeContext";
import { useMomentAddress } from "./useMomentAddress";

/**
 * Keeps the address' `t` current with the moment on show (see useMomentAddress). A component of its own, drawing
 * nothing, so that the moment changing re-renders this and nothing else (ADR-008). It stays mounted inside the page
 * whatever section is on show.
 */
export function MomentAddress() {
  useMomentAddress(useMoment().selection);
  return null;
}
