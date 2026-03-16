export interface LearningPacketRequest {
  topic: string;
  level?: "beginner" | "intermediate" | "advanced";
  modalities?: string[];
  freeOnly?: boolean;
}

export interface LearningPacket {
  topic: string;
  objectIds: string[];
  rationale: string;
}

export function packetKey(request: LearningPacketRequest): string {
  const level = request.level ?? "unspecified";
  const modalities = request.modalities?.join(",") ?? "any";

  return `${request.topic}:${level}:${modalities}:${request.freeOnly ?? false}`;
}
