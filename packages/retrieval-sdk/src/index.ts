export interface LearningPacketRequest {
  topic?: string;
  query?: string;
  level?: "beginner" | "intermediate" | "advanced";
  modalities?: string[];
  freeOnly?: boolean;
  trustMin?: number;
}

export interface LearningPacket {
  topic?: string;
  query: string;
  objectIds: string[];
  rationale: string;
  qualityReport?: RetrievalQualityReport;
}

export interface RetrievalQualityReport {
  query: string;
  returned: number;
  score: number;
  warnings: string[];
  metrics: {
    averageTrust: number;
    averageLexicalSimilarity: number;
    sourceDiversity: number;
    modalityDiversity: number;
    trustFloor: number;
  };
}

export function packetKey(request: LearningPacketRequest): string {
  const topic = request.topic ?? request.query ?? "untitled";
  const level = request.level ?? "unspecified";
  const modalities = request.modalities?.join(",") ?? "any";

  return `${topic}:${level}:${modalities}:${request.freeOnly ?? false}:${request.trustMin ?? 0}`;
}
