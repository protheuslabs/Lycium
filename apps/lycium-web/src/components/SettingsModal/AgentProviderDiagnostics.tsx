import type { AgentKeyRecord, AgentProviderRecord } from "../../courseTypes";

type AgentProviderDiagnosticsProps = {
  agentKeys: AgentKeyRecord[];
  agentProviders: AgentProviderRecord[];
  agentProviderId: string;
  verifyingAgentKeyId: string | null;
  onVerifyAgentKey: (keyId: string) => void;
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const statusLabel = (key?: AgentKeyRecord) => {
  if (!key) return "Not connected";
  return key.connection_status === "verified" ? "Verified" : "Needs check";
};

const providerMessage = (key?: AgentKeyRecord, provider?: AgentProviderRecord) => {
  if (!key) {
    return provider?.local_provider
      ? "Add a local endpoint to let Lycium discover models."
      : "Add a provider credential to enable generation.";
  }
  if (key.connection_status === "verified") {
    return key.models?.length
      ? `${key.models.length} model${key.models.length === 1 ? "" : "s"} discovered.`
      : "Connection verified. No models were reported.";
  }
  return key.last_error || key.connection_message || "Connection has not been verified yet.";
};

export default function AgentProviderDiagnostics({
  agentKeys,
  agentProviders,
  agentProviderId,
  verifyingAgentKeyId,
  onVerifyAgentKey,
}: AgentProviderDiagnosticsProps) {
  const activeKey = agentKeys.find((key) => key.is_active);
  const selectedProvider =
    agentProviders.find((provider) => provider.id === (activeKey?.provider_id ?? agentProviderId)) ??
    agentProviders.find((provider) => provider.id === agentProviderId);
  const isLocalProvider = Boolean(selectedProvider?.local_provider);
  const isVerifyingActiveKey = Boolean(activeKey && verifyingAgentKeyId === activeKey.id);
  const modelCount = activeKey?.models?.length ?? 0;

  return (
    <section className="settings-diagnostics-panel" aria-label="AI connection diagnostics">
      <div className="settings-diagnostics-header">
        <div>
          <p className="settings-diagnostics-eyebrow">Connection diagnostics</p>
          <h3>{activeKey?.provider_label ?? selectedProvider?.label ?? "No active AI"}</h3>
        </div>
        <span
          className={`settings-diagnostics-status settings-diagnostics-status-${activeKey?.connection_status ?? "empty"}`}
        >
          {isVerifyingActiveKey ? "Checking" : statusLabel(activeKey)}
        </span>
      </div>

      <div className="settings-diagnostics-grid">
        <div className="settings-diagnostics-item">
          <span>Provider</span>
          <strong>{activeKey?.provider_label ?? selectedProvider?.label ?? "None selected"}</strong>
        </div>
        <div className="settings-diagnostics-item">
          <span>Model</span>
          <strong>{activeKey?.model || selectedProvider?.default_model || "Not selected"}</strong>
        </div>
        <div className="settings-diagnostics-item">
          <span>Last check</span>
          <strong>{formatTimestamp(activeKey?.last_verified_at ?? activeKey?.models_fetched_at)}</strong>
        </div>
        <div className="settings-diagnostics-item">
          <span>Models</span>
          <strong>{modelCount ? `${modelCount} discovered` : "None cached"}</strong>
        </div>
        <div className="settings-diagnostics-item settings-diagnostics-item-wide">
          <span>{isLocalProvider ? "Local endpoint" : "Credential state"}</span>
          <strong>{isLocalProvider ? activeKey?.key_preview || "No endpoint saved" : statusLabel(activeKey)}</strong>
        </div>
      </div>

      <div className="settings-diagnostics-footer">
        <p>{providerMessage(activeKey, selectedProvider)}</p>
        {activeKey && (
          <button
            className="settings-diagnostics-check"
            type="button"
            disabled={Boolean(verifyingAgentKeyId)}
            onClick={() => onVerifyAgentKey(activeKey.id)}
          >
            {isVerifyingActiveKey ? "Checking" : "Check connection"}
          </button>
        )}
      </div>
    </section>
  );
}
