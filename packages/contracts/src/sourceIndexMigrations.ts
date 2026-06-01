import type { LyciumSourcePacket } from "./sourceIndexTypes";

type SourcePacketQuality = LyciumSourcePacket["quality"];

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function summarizeSourcePacketQuality(packet: Record<string, unknown>): SourcePacketQuality {
  const sources = arrayValue(packet.sources);
  const sourceDocuments = arrayValue(packet.source_documents);
  const warnings = arrayValue(packet.warnings);
  const snapshotCount = sources.filter((source) => arrayValue(objectValue(source).snapshots).length > 0).length;
  const evidenceCount = sources.filter((source) => arrayValue(objectValue(source).evidence_refs).length > 0).length;
  const includedSourceCount = sources.length;
  const sourceDocumentCount = sourceDocuments.length;
  const documentCoverageRatio = includedSourceCount ? sourceDocumentCount / includedSourceCount : 0;
  const evidenceCoverageRatio = includedSourceCount ? evidenceCount / includedSourceCount : 0;
  const snapshotCoverageRatio = includedSourceCount ? snapshotCount / includedSourceCount : 0;
  return {
    status: includedSourceCount === 0 ? "empty" : documentCoverageRatio >= 1 && evidenceCoverageRatio >= 1 ? "usable" : "needs_review",
    includedSourceCount,
    sourceDocumentCount,
    snapshotCoverageRatio: Number(snapshotCoverageRatio.toFixed(3)),
    documentCoverageRatio: Number(documentCoverageRatio.toFixed(3)),
    evidenceCoverageRatio: Number(evidenceCoverageRatio.toFixed(3)),
    warningCount: warnings.length,
  };
}

export function migrateSourcePacketV1(packet: Record<string, unknown>): Record<string, unknown> {
  if (packet.contract_version !== "source-packet-v1") {
    return packet;
  }
  if (packet.quality && typeof packet.quality === "object") {
    return packet;
  }
  return {
    ...packet,
    quality: summarizeSourcePacketQuality(packet),
  };
}
