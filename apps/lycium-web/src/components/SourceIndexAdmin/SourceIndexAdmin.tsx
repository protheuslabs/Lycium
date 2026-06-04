"use client";

import { useMemo, useState } from "react";
import Button from "../Button/Button";
import { API_BASE } from "../../runtime/appRuntime";
import { localCourses } from "../../courseData/localCourses";
import type { CourseEntry } from "../../courseTypes";
import "./SourceIndexAdmin.css";

const SOURCE_TYPE_OPTIONS = [
  { value: "web", label: "Web page" },
  { value: "syllabus", label: "Syllabus" },
  { value: "catalog", label: "Course catalog" },
  { value: "curriculum", label: "Curriculum" },
  { value: "open_courseware", label: "Open courseware" },
  { value: "textbook", label: "Textbook" },
  { value: "standard", label: "Standard" },
  { value: "certification", label: "Certification" },
  { value: "employer_profile", label: "Employer profile" },
  { value: "research", label: "Research" },
];

const INTENDED_USE_OPTIONS = [
  { value: "general_index", label: "General index" },
  { value: "curriculum_benchmark", label: "Curriculum benchmark" },
  { value: "course_generation", label: "Course generation" },
  { value: "program_generation", label: "Program generation" },
  { value: "replacement_source", label: "Replacement source" },
  { value: "general_research", label: "General research" },
];

type ImportReport = Record<string, unknown>;

type SmokeSummary = {
  import?: ImportReport;
  packet?: Record<string, unknown>;
  fit?: SourceFitReport;
  sourceRows: SourceRowSummary[];
};

type SourceRowSummary = {
  sourceId: number | null;
  canonicalUrl: string;
  title: string;
  sourceType: string;
  warnings: string[];
};

type SourceFitCandidate = {
  source_id?: number | null;
  source_url?: string | null;
  source_title?: string | null;
  target_type: string;
  target_id: string;
  target_title: string;
  fit_score: number;
  matched_terms: string[];
  fit_reason: string;
  suggested_use: string;
  confidence: string;
};

type SourceFitReport = {
  candidates?: SourceFitCandidate[];
  candidate_count?: number;
  warnings?: string[];
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

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function safeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function sourceRows(importReport: ImportReport): SourceRowSummary[] {
  const rows = Array.isArray(importReport.sources) ? importReport.sources : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const source = (row as { source?: unknown }).source;
    if (!source || typeof source !== "object") return [];
    const record = source as Record<string, unknown>;
    const warnings = Array.isArray((row as { warnings?: unknown }).warnings)
      ? ((row as { warnings: unknown[] }).warnings.map(String))
      : [];
    return [
      {
        sourceId: typeof record.id === "number" ? record.id : null,
        canonicalUrl: String(record.canonical_url ?? ""),
        title: String(record.title ?? "Untitled source"),
        sourceType: String(record.source_type ?? "unknown"),
        warnings,
      },
    ];
  });
}

function canonicalUrls(importReport: ImportReport): string[] {
  return sourceRows(importReport).map((row) => row.canonicalUrl).filter(Boolean);
}

function textValues(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (typeof value === "object") return Object.values(value).flatMap(textValues);
  return [];
}

function courseConcepts(course: CourseEntry): string[] {
  const conceptValues = course.data.modules.flatMap((module) =>
    module.sections.flatMap((section) =>
      section.content.flatMap((block) => {
        if (!block || typeof block !== "object") return [];
        const record = block as Record<string, unknown>;
        if (record.type !== "conceptCards") return [];
        return textValues(record.concepts).slice(0, 24);
      }),
    ),
  );
  return Array.from(new Set(conceptValues)).slice(0, 40);
}

function courseFitTargets() {
  return localCourses.map((course) => ({
    target_id: course.key,
    target_type: "course",
    title: course.title,
    description: course.data.shortDescription ?? (course.data as { description?: string }).description ?? "",
    concepts: courseConcepts(course),
    requirements: [
      ...(course.data.modules ?? []).map((module) => module.title),
      ...(course.data.modules ?? []).flatMap((module) => module.sections.map((section) => section.title)),
    ].slice(0, 60),
    tags: course.data.tags ?? [],
  }));
}

export default function SourceIndexAdmin() {
  const [sourceUrls, setSourceUrls] = useState("");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceType, setSourceType] = useState("web");
  const [intendedUse, setIntendedUse] = useState("general_index");
  const [license, setLicense] = useState("unknown");
  const [isFree, setIsFree] = useState(true);
  const [rawText, setRawText] = useState("");
  const [buildPacket, setBuildPacket] = useState(true);
  const [fetchSources, setFetchSources] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<SmokeSummary | null>(null);

  const parsedUrls = useMemo(() => lines(sourceUrls), [sourceUrls]);
  const hasRawTextForBatch = parsedUrls.length === 1 && rawText.trim().length > 0;
  const canRun = parsedUrls.length > 0 && status !== "loading";

  const runImport = async () => {
    setStatus("loading");
    setMessage("Importing sources into the source index.");
    setSummary(null);
    try {
      const batchTopic = topic.trim();
      const importTags = splitTags(tags);
      const batchId = `manual-source-index-${safeSlug(batchTopic || intendedUse) || "source"}-${Date.now()}`;
      const metadata = {
        origin: "direct_source_index_admin",
        intended_use: intendedUse,
        topic: batchTopic || undefined,
        tags: importTags,
        notes: notes.trim() || undefined,
      };
      const importReport = await postJson("/v1/index/source-imports", {
        batch_id: batchId,
        sources: parsedUrls.map((url) => ({
          url,
          title: parsedUrls.length === 1 ? title.trim() || undefined : undefined,
          source_type: sourceType,
          license: license.trim() || "unknown",
          is_free: isFree,
          raw_text: hasRawTextForBatch ? rawText.trim() : undefined,
          content_type: hasRawTextForBatch ? "text/plain" : undefined,
          metadata,
        })),
      });
      const rows = sourceRows(importReport);
      const urlsForPacket = canonicalUrls(importReport);
      const packetPrompt = batchTopic || notes.trim() || importTags.join(" ") || urlsForPacket.join("\n");
      const packet = buildPacket
        ? await postJson("/v1/index/source-packets", {
            consumer: "lycium-source-index-admin",
            context_id: String(importReport.batch_id ?? batchId),
            prompt: packetPrompt,
            source_urls: urlsForPacket,
            fetch_sources: fetchSources,
            snapshot_limit: fetchSources || hasRawTextForBatch ? 1 : 0,
          })
        : undefined;
      const fit = await postJson("/v1/index/source-fit", {
        sources: rows.map((row) => ({
          source_id: row.sourceId,
          url: row.canonicalUrl,
          title: row.title,
          source_type: row.sourceType,
        })),
        targets: courseFitTargets(),
        limit: 16,
        minimum_score: 0.18,
      });
      setSummary({ import: importReport, packet, fit, sourceRows: rows });
      setStatus("success");
      setMessage(packet ? "Sources imported, packet generated, and course candidates checked." : "Sources imported and course candidates checked.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Source import failed.");
    }
  };

  const packetRun = summary?.packet?.corpus_run as Record<string, unknown> | undefined;
  const packetQuality = summary?.packet?.quality as Record<string, unknown> | undefined;
  const packetDocuments = Array.isArray(summary?.packet?.source_documents) ? summary.packet.source_documents : [];
  const fitCandidates = Array.isArray(summary?.fit?.candidates) ? summary.fit.candidates : [];

  return (
    <main className="source-index-admin-page">
      <section className="source-index-admin-panel">
        <p className="source-index-admin-eyebrow">Source Index</p>
        <h1>Direct source import</h1>
        <p className="source-index-admin-copy">
          Add public learning sources directly to the index without attaching them to a course first. Lycium can use these records later for course generation, curriculum benchmarks, source packets, and replacement-source workflows.
        </p>
        <div className="source-index-admin-grid">
          <label className="source-index-admin-field source-index-admin-field-wide">
            <span>Source URLs</span>
            <textarea
              className="source-index-admin-url-box"
              value={sourceUrls}
              onChange={(event) => setSourceUrls(event.target.value)}
              placeholder="Paste one source URL per line"
              spellCheck={false}
            />
          </label>
          <label className="source-index-admin-field">
            <span>Topic</span>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="General chemistry, software architecture..." />
          </label>
          <label className="source-index-admin-field">
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional for a single URL" />
          </label>
          <label className="source-index-admin-field">
            <span>Source type</span>
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
              {SOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="source-index-admin-field">
            <span>Intended use</span>
            <select value={intendedUse} onChange={(event) => setIntendedUse(event.target.value)}>
              {INTENDED_USE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="source-index-admin-field">
            <span>Tags</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Comma-separated" />
          </label>
          <label className="source-index-admin-field">
            <span>License</span>
            <input value={license} onChange={(event) => setLicense(event.target.value)} placeholder="unknown, CC BY, public domain..." />
          </label>
          <label className="source-index-admin-field source-index-admin-field-wide">
            <span>Notes</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Why this source belongs in the index" />
          </label>
          <label className="source-index-admin-field source-index-admin-field-wide">
            <span>Optional extracted text</span>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Optional. When importing exactly one URL, pasted text creates an immediate snapshot."
              spellCheck={false}
            />
          </label>
        </div>
        <div className="source-index-admin-switches" aria-label="Source import options">
          <label>
            <input type="checkbox" checked={isFree} onChange={(event) => setIsFree(event.target.checked)} />
            <span>Free to access</span>
          </label>
          <label>
            <input type="checkbox" checked={buildPacket} onChange={(event) => setBuildPacket(event.target.checked)} />
            <span>Build source packet after import</span>
          </label>
          <label>
            <input type="checkbox" checked={fetchSources} onChange={(event) => setFetchSources(event.target.checked)} disabled={!buildPacket} />
            <span>Fetch/extract URLs for packet evidence</span>
          </label>
        </div>
        <div className="source-index-admin-actions">
          <Button disabled={!canRun} onClick={runImport}>
            {status === "loading" ? "Importing" : `Import ${parsedUrls.length || ""} source${parsedUrls.length === 1 ? "" : "s"}`}
          </Button>
          <span className={`source-index-admin-status source-index-admin-status-${status}`}>{message}</span>
        </div>
        {summary && (
          <section className="source-index-admin-results" aria-label="Source index import results">
            <div className="source-index-admin-summary">
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
            </div>
            {packetQuality && (
              <p className="source-index-admin-quality">
                Packet status: <strong>{String(packetQuality.status ?? "unknown")}</strong>
                {typeof packetQuality.warningCount === "number" ? ` · ${packetQuality.warningCount} warnings` : ""}
              </p>
            )}
            <div className="source-index-admin-source-list">
              {summary.sourceRows.map((row) => (
                <article key={row.canonicalUrl}>
                  <strong>{row.title}</strong>
                  <a href={row.canonicalUrl} target="_blank" rel="noreferrer">{row.canonicalUrl}</a>
                  <span>{row.sourceType}</span>
                  {row.warnings.map((warning) => <em key={warning}>{warning}</em>)}
                </article>
              ))}
            </div>
            {fitCandidates.length > 0 && (
              <section className="source-index-admin-candidates" aria-label="Course candidate suggestions">
                <h2>Course candidates</h2>
                <p>These are review suggestions only. The source is not attached to a course until a reviewer accepts it.</p>
                <div>
                  {fitCandidates.map((candidate) => (
                    <article key={`${candidate.source_url}-${candidate.target_id}-${candidate.fit_score}`}>
                      <strong>{candidate.target_title}</strong>
                      <span>{candidate.suggested_use} · {candidate.confidence} · {Math.round(candidate.fit_score * 100)}%</span>
                      <p>{candidate.fit_reason}</p>
                      {candidate.source_title && <em>{candidate.source_title}</em>}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
