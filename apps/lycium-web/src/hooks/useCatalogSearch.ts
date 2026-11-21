import { useState, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function readQuery() {
  return new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
}

export function useCatalogSearch() {
  const routeQuery = useSyncExternalStore(subscribe, readQuery, () => "");
  const [edit, setEdit] = useState<{ routeQuery: string; value: string } | null>(null);
  const query = edit?.routeQuery === routeQuery ? edit.value : routeQuery;
  const setQuery = (value: string) => setEdit({ routeQuery, value });
  return [query, setQuery] as const;
}
