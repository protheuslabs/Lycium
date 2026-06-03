import {
  LYCIUM_SOURCE_PACKET_CONTRACT_VERSION,
  LYCIUM_SOURCE_PACKET_SCHEMA_ID,
  type LyciumSourcePacket,
} from "./sourceIndexTypes";

type SourcePacketQuality = LyciumSourcePacket["quality"];
const BENCHMARK_SOURCE_TYPES = new Set([
  "catalog",
  "certification",
  "curriculum",
  "employer_profile",
  "open_courseware",
  "program",
  "standard",
  "syllabus",
]);
const BROKEN_LINK_HEALTH_VALUES = new Set(["broken", "dead", "failed", "unreachable"]);

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateValue(value: unknown): Date | null {
  const text = stringValue(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numberRecordValue(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(objectValue(value)).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])),
  );
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
  const sourceRecords = sources.map((source) => objectValue(objectValue(source).source));
  const canonicalUrls = sourceRecords.map((source) => stringValue(source.canonical_url)).filter(Boolean);
  const sourceTypes = sourceRecords.map((source) => stringValue(source.source_type) || "unknown");
  const sourceTypeMix = sourceTypes.reduce<Record<string, number>>((mix, sourceType) => {
    mix[sourceType] = (mix[sourceType] ?? 0) + 1;
    return mix;
  }, {});
  const trustScores = sourceRecords
    .map((source) => numberValue(source.trust_baseline))
    .filter((score): score is number => score !== null);
  const verificationDates = sourceRecords
    .map((source) => dateValue(source.last_verified_at) ?? dateValue(source.updated_at))
    .filter((date): date is Date => date !== null);
  const snapshotCount = sources.filter((source) => arrayValue(objectValue(source).snapshots).length > 0).length;
  const evidenceCount = sources.filter((source) => arrayValue(objectValue(source).evidence_refs).length > 0).length;
  const includedSourceCount = sources.length;
  const sourceDocumentCount = sourceDocuments.length;
  const duplicateSourceCount = Math.max(0, canonicalUrls.length - new Set(canonicalUrls).size);
  const brokenUrlCount = sourceRecords.filter((source) => BROKEN_LINK_HEALTH_VALUES.has(stringValue(source.link_health).toLowerCase())).length;
  const benchmarkSourceCount = sourceTypes.filter((sourceType) => BENCHMARK_SOURCE_TYPES.has(sourceType)).length;
  const staleVerificationCount = verificationDates.filter((date) => Date.now() - date.getTime() > 365 * 24 * 60 * 60 * 1000).length;
  const documentCoverageRatio = includedSourceCount ? sourceDocumentCount / includedSourceCount : 0;
  const evidenceCoverageRatio = includedSourceCount ? evidenceCount / includedSourceCount : 0;
  const snapshotCoverageRatio = includedSourceCount ? snapshotCount / includedSourceCount : 0;
  const averageTrustScore = trustScores.length ? trustScores.reduce((total, score) => total + score, 0) / trustScores.length : 0;
  const freshnessKnownRatio = includedSourceCount ? verificationDates.length / includedSourceCount : 0;
  const benchmarkUsefulnessRatio = includedSourceCount ? benchmarkSourceCount / includedSourceCount : 0;
  const qualityWarnings = [
    ...(duplicateSourceCount ? ["Packet contains duplicate canonical source URLs."] : []),
    ...(brokenUrlCount ? ["Packet contains sources marked with broken link health."] : []),
    ...(includedSourceCount && !benchmarkSourceCount ? ["Packet has no curriculum benchmark-oriented source types."] : []),
    ...(includedSourceCount && freshnessKnownRatio < 0.5 ? ["Most packet sources have no verification timestamp."] : []),
    ...(staleVerificationCount ? ["Packet contains sources that have not been verified recently."] : []),
  ];
  return {
    status:
      includedSourceCount === 0
        ? "empty"
        : documentCoverageRatio >= 1 && evidenceCoverageRatio >= 1 && !brokenUrlCount
          ? "usable"
          : "needs_review",
    includedSourceCount,
    sourceDocumentCount,
    duplicateSourceCount,
    brokenUrlCount,
    snapshotCoverageRatio: Number(snapshotCoverageRatio.toFixed(3)),
    documentCoverageRatio: Number(documentCoverageRatio.toFixed(3)),
    evidenceCoverageRatio: Number(evidenceCoverageRatio.toFixed(3)),
    sourceTypeMix,
    averageTrustScore: Number(averageTrustScore.toFixed(3)),
    freshnessKnownRatio: Number(freshnessKnownRatio.toFixed(3)),
    staleVerificationCount,
    benchmarkSourceCount,
    benchmarkUsefulnessRatio: Number(benchmarkUsefulnessRatio.toFixed(3)),
    qualityWarnings,
    warningCount: warnings.length + qualityWarnings.length,
  };
}

function normalizeSourcePacketQuality(packet: Record<string, unknown>): SourcePacketQuality {
  const summary = summarizeSourcePacketQuality(packet);
  const quality = objectValue(packet.quality);
  const sourceTypeMix = numberRecordValue(quality.sourceTypeMix);
  const qualityWarnings = arrayValue(quality.qualityWarnings).map(String).filter(Boolean);
  return {
    ...summary,
    ...quality,
    sourceTypeMix: Object.keys(sourceTypeMix).length ? sourceTypeMix : summary.sourceTypeMix,
    qualityWarnings: qualityWarnings.length ? qualityWarnings : summary.qualityWarnings,
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
    quality: normalizeSourcePacketQuality(packet),
  };
}
