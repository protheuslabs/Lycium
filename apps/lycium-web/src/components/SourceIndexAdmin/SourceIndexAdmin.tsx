"use client";

import { useMemo, useState } from "react";
import Button from "../Button/Button";
import { API_BASE } from "../../runtime/appRuntime";
import "./SourceIndexAdmin.css";

const DEFAULT_BATCH = `{
  "batch_id": "manual-source-index-seed",
  "sources": [
    {
      "url": "https://example.edu/learning/source-one",
      "title": "Example source",
      "source_type": "open_courseware",
      "license": "unknown",
      "raw_text": "Paste extracted or manually curated source text here.",
      "content_type": "text/plain"
    }
  ]
}`;

type SmokeSummary = {
  import?: Record<string, unknown>;
  packet?: Record<string, unknown>;
};

async function postJson(path: string, payload: unknown) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function canonicalUrls(importReport: Record<string, unknown>): string[] {
  const rows = Array.isArray(importReport.sources) ? importReport.sources : [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      const source = (row as { source?: unknown }).source;
      if (!source || typeof source !== "object") return "";
      return String((source as { canonical_url?: unknown }).canonical_url ?? "");
    })
    .filter(Boolean);
}

export default function SourceIndexAdmin() {
  const [batchJson, setBatchJson] = useState(DEFAULT_BATCH);
  const [prompt, setPrompt] = useState("reliability observability latency replication");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<SmokeSummary | null>(null);

  const canRun = useMemo(() => batchJson.trim().length > 0 && prompt.trim().length > 0 && status !== "loading", [batchJson, prompt, status]);

  const runImport = async () => {
    setStatus("loading");
    setMessage("Importing source batch and building source packet.");
    setSummary(null);
    try {
      const batch = JSON.parse(batchJson);
      const importReport = await postJson("/v1/index/source-imports", batch);
      const packet = await postJson("/v1/index/source-packets", {
        consumer: "lycium-source-index-admin",
        context_id: String(importReport.batch_id ?? "source-index-admin"),
        prompt,
        source_urls: canonicalUrls(importReport),
        fetch_sources: false,
        snapshot_limit: 1,
      });
      setSummary({ import: importReport, packet });
      setStatus("success");
      setMessage("Source packet generated.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Source import failed.");
    }
  };

  const packetRun = summary?.packet?.corpus_run as Record<string, unknown> | undefined;
  const packetDocuments = Array.isArray(summary?.packet?.source_documents) ? summary.packet.source_documents : [];

  return (
    <main className="source-index-admin-page">
      <section className="source-index-admin-panel">
        <p className="source-index-admin-eyebrow">Developer primitive</p>
        <h1>Source Index import</h1>
        <p className="source-index-admin-copy">
          Import a generic curated source batch, then build a source packet from the prompt. This is intentionally not tied to any one course.
        </p>
        <label className="source-index-admin-field">
          <span>Prompt</span>
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <label className="source-index-admin-field">
          <span>Source batch JSON</span>
          <textarea value={batchJson} onChange={(event) => setBatchJson(event.target.value)} spellCheck={false} />
        </label>
        <div className="source-index-admin-actions">
          <Button disabled={!canRun} onClick={runImport}>
            {status === "loading" ? "Running" : "Import and build packet"}
          </Button>
          <span className={`source-index-admin-status source-index-admin-status-${status}`}>{message}</span>
        </div>
        {summary && (
          <section className="source-index-admin-summary" aria-label="Source index import summary">
            <div>
              <span>Imported</span>
              <strong>{String(summary.import?.imported_count ?? 0)}</strong>
            </div>
            <div>
              <span>Snapshots</span>
              <strong>{String(summary.import?.snapshot_count ?? 0)}</strong>
            </div>
            <div>
              <span>Included</span>
              <strong>{String(packetRun?.included_source_count ?? 0)}</strong>
            </div>
            <div>
              <span>Documents</span>
              <strong>{String(packetDocuments.length)}</strong>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
