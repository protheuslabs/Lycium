import type { AgentKeyRecord } from "../courseTypes";

export type AiConnectionReadiness = {
  ready: boolean;
  lockedReason: string;
  activeKey: AgentKeyRecord | null;
};

export type AiConnectionStatus = "active" | "ready" | "checking" | "unverified" | "missing_model" | "underpowered";

export type AiConnectionStatusSummary = {
  status: AiConnectionStatus;
  label: string;
};

export const AI_CONNECTION_LOCK_REASONS = {
  noActiveConnection: "Connect and verify an AI model in Settings before using AI features.",
  unverifiedConnection: (providerLabel: string) =>
    `${providerLabel} is saved but not connected. Refresh the connection in Settings before using AI features.`,
  missingModel: (providerLabel: string) =>
    `Choose a model for ${providerLabel} in Settings before using AI features.`,
  belowRecommendedFloor: (providerLabel: string, warning?: string | null) =>
    warning ||
    `${providerLabel} is connected, but the selected model is below Lycium's recommended course-generation capacity. Choose a 70B+ model.`,
};

export function describeAiConnectionReadiness(agentKeys: AgentKeyRecord[]): AiConnectionReadiness {
  const activeKey = agentKeys.find((key) => key.is_active) ?? null;

  if (!activeKey) {
    return {
      ready: false,
      lockedReason: AI_CONNECTION_LOCK_REASONS.noActiveConnection,
      activeKey: null,
    };
  }

  if (activeKey.connection_status === "unverified") {
    return {
      ready: false,
      lockedReason: AI_CONNECTION_LOCK_REASONS.unverifiedConnection(activeKey.provider_label),
      activeKey,
    };
  }

  if (!activeKey.model) {
    return {
      ready: false,
      lockedReason: AI_CONNECTION_LOCK_REASONS.missingModel(activeKey.provider_label),
      activeKey,
    };
  }

  if (activeKey.model_capability?.meets_recommended_floor === false) {
    return {
      ready: false,
      lockedReason: AI_CONNECTION_LOCK_REASONS.belowRecommendedFloor(
        activeKey.provider_label,
        activeKey.model_capability.warning,
      ),
      activeKey,
    };
  }

  return {
    ready: true,
    lockedReason: "",
    activeKey,
  };
}

export function describeAgentKeyConnectionStatus(
  key: AgentKeyRecord,
  { isChecking = false }: { isChecking?: boolean } = {},
): AiConnectionStatusSummary {
  if (isChecking) {
    return { status: "checking", label: "Checking" };
  }

  if (key.connection_status === "unverified") {
    return { status: "unverified", label: "Not connected" };
  }

  if (!key.model) {
    return { status: "missing_model", label: "Choose model" };
  }

  if (key.model_capability?.meets_recommended_floor === false) {
    return { status: "underpowered", label: "Use 70B+" };
  }

  if (key.is_active) {
    return { status: "active", label: "Active" };
  }

  return { status: "ready", label: "Ready" };
}

export function describeAgentKeyConnectionDetail(
  key: AgentKeyRecord,
  { isChecking = false }: { isChecking?: boolean } = {},
): string {
  if (isChecking) {
    return `Checking ${key.provider_label}.`;
  }

  if (key.connection_status === "unverified") {
    return key.last_error || key.connection_message || AI_CONNECTION_LOCK_REASONS.unverifiedConnection(key.provider_label);
  }

  if (!key.model) {
    return AI_CONNECTION_LOCK_REASONS.missingModel(key.provider_label);
  }

  if (key.model_capability?.meets_recommended_floor === false) {
    return AI_CONNECTION_LOCK_REASONS.belowRecommendedFloor(
      key.provider_label,
      key.model_capability.warning,
    );
  }

  if (key.is_active) {
    return `${key.provider_label} is active with ${key.model}.`;
  }

  return `${key.provider_label} is verified and ready to use.`;
}
