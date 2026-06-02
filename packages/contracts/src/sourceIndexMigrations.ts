import {
  LYCIUM_SOURCE_PACKET_CONTRACT_VERSION,
  LYCIUM_SOURCE_PACKET_SCHEMA_ID,
  type LyciumSourcePacket,
} from "./sourceIndexTypes";

type SourcePacketQuality = LyciumSourcePacket["quality"];

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackPacketId(packet: Record<string, unknown>): string {
  const seed = [
    stringValue(packet.consumer),
    stringValue(packet.context_id),
    stringValue(packet.prompt),
    ...arrayValue(packet.source_urls).map((url) => stringValue(url)).filter(Boolean).sort(),
  ]
    .filter(Boolean)
    .join("|");
  let hash = 0;
  for (const character of seed || "source-packet-v1") {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `source-packet-${hash.toString(16).padStart(8, "0")}`;
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
  if (packet.contract_version !== LYCIUM_SOURCE_PACKET_CONTRACT_VERSION) {
    return packet;
  }
  const producer = objectValue(packet.producer);
  return {
    ...packet,
    packet_id: stringValue(packet.packet_id) || fallbackPacketId(packet),
    generated_at: stringValue(packet.generated_at) || new Date(0).toISOString(),
    producer: {
      service: stringValue(producer.service) || "unknown-source-index",
      version: stringValue(producer.version) || LYCIUM_SOURCE_PACKET_CONTRACT_VERSION,
      schema_id: stringValue(producer.schema_id) || LYCIUM_SOURCE_PACKET_SCHEMA_ID,
    },
    quality: packet.quality && typeof packet.quality === "object" ? packet.quality : summarizeSourcePacketQuality(packet),
  };
}
