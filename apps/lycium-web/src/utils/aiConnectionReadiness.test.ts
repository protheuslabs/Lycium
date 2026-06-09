import { describe, expect, it } from "vitest";
import type { AgentKeyRecord } from "../courseTypes";
import {
  AI_CONNECTION_LOCK_REASONS,
  describeAgentKeyConnectionDetail,
  describeAgentKeyConnectionStatus,
  describeAiConnectionReadiness,
} from "./aiConnectionReadiness";

function agentKey(overrides: Partial<AgentKeyRecord> = {}): AgentKeyRecord {
  return {
    id: "test-key",
    provider_id: "test-provider",
    provider_label: "Test Provider",
    key_preview: "******test",
    model: "test-model",
    models: [{ id: "test-model", label: "Test Model" }],
    connection_status: "verified",
    is_active: true,
    ...overrides,
  } as AgentKeyRecord;
}

describe("describeAiConnectionReadiness", () => {
  it("requires an active connection", () => {
    const readiness = describeAiConnectionReadiness([]);

    expect(readiness.ready).toBe(false);
    expect(readiness.activeKey).toBeNull();
    expect(readiness.lockedReason).toBe(AI_CONNECTION_LOCK_REASONS.noActiveConnection);
  });

  it("blocks unverified active connections", () => {
    const readiness = describeAiConnectionReadiness([
      agentKey({ connection_status: "unverified", provider_label: "Ollama Local" }),
    ]);

    expect(readiness.ready).toBe(false);
    expect(readiness.activeKey?.provider_label).toBe("Ollama Local");
    expect(readiness.lockedReason).toBe(AI_CONNECTION_LOCK_REASONS.unverifiedConnection("Ollama Local"));
  });

  it("requires a selected model", () => {
    const readiness = describeAiConnectionReadiness([agentKey({ model: null })]);

    expect(readiness.ready).toBe(false);
    expect(readiness.lockedReason).toBe(AI_CONNECTION_LOCK_REASONS.missingModel("Test Provider"));
  });

  it("is ready when the active connection is verified and has a model", () => {
    const readiness = describeAiConnectionReadiness([agentKey()]);

    expect(readiness.ready).toBe(true);
    expect(readiness.lockedReason).toBe("");
    expect(readiness.activeKey?.id).toBe("test-key");
  });

  it("describes saved key row status consistently", () => {
    expect(describeAgentKeyConnectionStatus(agentKey(), { isChecking: true })).toEqual({
      status: "checking",
      label: "Checking",
    });
    expect(describeAgentKeyConnectionStatus(agentKey({ connection_status: "unverified" }))).toEqual({
      status: "unverified",
      label: "Not connected",
    });
    expect(describeAgentKeyConnectionStatus(agentKey({ model: null }))).toEqual({
      status: "missing_model",
      label: "Choose model",
    });
    expect(describeAgentKeyConnectionStatus(agentKey({ is_active: false }))).toEqual({
      status: "ready",
      label: "Ready",
    });
  });

  it("describes saved key row details without adding a diagnostics panel", () => {
    expect(describeAgentKeyConnectionDetail(agentKey(), { isChecking: true })).toBe("Checking Test Provider.");
    expect(
      describeAgentKeyConnectionDetail(
        agentKey({ connection_status: "unverified", last_error: "Provider could not be reached." }),
      ),
    ).toBe("Provider could not be reached.");
    expect(describeAgentKeyConnectionDetail(agentKey({ model: null }))).toBe(
      AI_CONNECTION_LOCK_REASONS.missingModel("Test Provider"),
    );
    expect(describeAgentKeyConnectionDetail(agentKey())).toBe("Test Provider is active with test-model.");
  });
});
