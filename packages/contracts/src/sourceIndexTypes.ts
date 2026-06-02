export const LYCIUM_SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1" as const;
export const LYCIUM_SOURCE_PACKET_SCHEMA_ID = "https://protheuslabs.github.io/Lycium/schemas/lycium-source-packet.schema.json";

export type LyciumSourcePacketProducer = {
  service: string;
  version: string;
  schema_id: string;
};

export type LyciumSourceIndexRef = {
  service: string;
  sourcePublicId?: string | null;
  snapshotPublicId?: string | null;
  sourceRemoteId?: number | string | null;
  snapshotRemoteId?: number | string | null;
  sourceLocalId?: number | string | null;
  snapshotLocalId?: number | string | null;
};

export type LyciumImportedSourceInput = {
  url: string;
  title?: string;
  source_type?: string;
  sourceType?: string;
  license?: string;
  is_free?: boolean;
  isFree?: boolean;
  raw_text?: string;
  rawText?: string;
  content_type?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
};

export type LyciumSourceImportBatch = {
  batch_id?: string;
  sources: LyciumImportedSourceInput[];
};

export type LyciumIndexedSourceRecord = {
  id: number | string;
  public_id?: string | null;
  canonical_url: string;
  normalized_domain?: string;
  submitted_urls?: string[];
  title?: string | null;
  source_type?: string;
  license?: string;
  is_free?: boolean;
  trust_baseline?: number;
  link_health?: string;
  archive_links?: string[];
  last_verified_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type LyciumSourceSnapshotRecord = {
  id: number | string;
  public_id?: string | null;
  source_id: number | string;
  fetched_at?: string;
  status?: string;
  content_hash?: string | null;
  content_type?: string | null;
  title?: string | null;
  text_digest?: string | null;
  extracted_text?: string;
  raw_storage_ref?: string | null;
  snapshot_metadata?: Record<string, unknown>;
};

export type LyciumSourceDecisionRecord = {
  id: number | string;
  corpus_run_id?: number | string;
  source_id?: number | string;
  consumer?: string;
  context_id?: string;
  original_url?: string;
  source_url?: string;
  decision: "included" | "excluded" | string;
  relevance_score?: number;
  matched_terms?: string[];
  reason?: string | null;
  rationale?: string | null;
  payload?: Record<string, unknown>;
  created_at?: string;
};

export type LyciumSourceDocument = {
  url: string;
  contentType?: string;
  content_type?: string;
  text: string;
  sourceId?: string;
  snapshotId?: string | null;
  title?: string | null;
  sourceIndexRef?: LyciumSourceIndexRef;
};

export type LyciumSourceImportReport = {
  contract_version: "source-import-batch-v1";
  batch_id: string;
  submitted_count: number;
  imported_count: number;
  snapshot_count: number;
  sources: Array<{
    original_index: number;
    source: LyciumIndexedSourceRecord;
    snapshot?: LyciumSourceSnapshotRecord | null;
    created_snapshot: boolean;
    warnings: string[];
  }>;
  warnings: string[];
};

export type LyciumSourceCorpusRun = {
  id: number | string;
  consumer: string;
  context_id: string;
  prompt: string;
  workflow_version?: string;
  submitted_source_count: number;
  included_source_count: number;
  excluded_source_count: number;
  common_themes?: Array<Record<string, unknown>>;
  payload?: Record<string, unknown>;
  decisions: LyciumSourceDecisionRecord[];
  created_at?: string;
  updated_at?: string;
};

export type LyciumSourcePacket = {
  contract_version: typeof LYCIUM_SOURCE_PACKET_CONTRACT_VERSION;
  packet_id: string;
  generated_at: string;
  producer: LyciumSourcePacketProducer;
  consumer: string;
  context_id: string;
  prompt: string;
  source_urls: string[];
  corpus_run: LyciumSourceCorpusRun;
  sources: Array<{
    source: LyciumIndexedSourceRecord;
    decision: LyciumSourceDecisionRecord;
    snapshots: LyciumSourceSnapshotRecord[];
    evidence_refs: string[];
    source_document?: LyciumSourceDocument | null;
  }>;
  source_documents: LyciumSourceDocument[];
  synthesis: Record<string, unknown>;
  warnings: string[];
  quality: {
    status: "usable" | "needs_review" | "empty" | string;
    includedSourceCount: number;
    sourceDocumentCount: number;
    snapshotCoverageRatio: number;
    documentCoverageRatio: number;
    evidenceCoverageRatio: number;
    warningCount: number;
  };
};
