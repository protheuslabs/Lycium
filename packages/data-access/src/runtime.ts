import type { LyciumRuntimeConfig, LyciumRuntimeConfigInput, LyciumRuntimeMode } from "./types";
import { normalizeApiBase } from "./http";

function normalizeRuntimeMode(mode: string | null | undefined): LyciumRuntimeMode {
  return mode === "cloud" || mode === "static" || mode === "infring" || mode === "local" ? mode : "local";
}

export function resolveLyciumRuntimeConfig(input: LyciumRuntimeConfigInput = {}): LyciumRuntimeConfig {
  return {
    mode: normalizeRuntimeMode(input.mode),
    apiBaseUrl: normalizeApiBase(input.apiBaseUrl ?? undefined),
    catalogUrl: input.catalogUrl || undefined,
    courseBaseUrl: input.courseBaseUrl || undefined,
    headers: input.headers,
  };
}
