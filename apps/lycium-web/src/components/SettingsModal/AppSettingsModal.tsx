import type { useAgentSettings } from "../../hooks/useAgentSettings";
import SettingsModal from "./SettingsModal";

type AgentSettingsState = ReturnType<typeof useAgentSettings>;

type AppSettingsModalProps = {
  isOpen: boolean;
  agentSettings: AgentSettingsState;
  onClose: () => void;
};

export default function AppSettingsModal({ isOpen, agentSettings, onClose }: AppSettingsModalProps) {
  return (
    <SettingsModal
      isOpen={isOpen}
      agentKeys={agentSettings.agentKeys}
      agentProviders={agentSettings.agentProviders}
      agentProviderId={agentSettings.agentProviderId}
      agentApiKey={agentSettings.agentApiKey}
      apiKeySaveStatus={agentSettings.apiKeySaveStatus}
      verifyingAgentKeyId={agentSettings.verifyingAgentKeyId}
      canAddAgentKey={agentSettings.canAddAgentKey}
      settingsStatus={agentSettings.settingsStatus}
      settingsMessage={agentSettings.settingsMessage}
      themeMode={agentSettings.themeMode}
      onClose={onClose}
      onActivateAgentKey={agentSettings.handleActivateAgentKey}
      onAgentModelChange={agentSettings.handleAgentModelChange}
      onEditAgentKey={agentSettings.handleEditAgentKey}
      onDeleteAgentKey={agentSettings.handleDeleteAgentKey}
      onAgentProviderChange={agentSettings.setAgentProviderId}
      onAgentApiKeyChange={agentSettings.setAgentApiKey}
      onApiKeySaveStatusChange={agentSettings.setApiKeySaveStatus}
      onSettingsSubmit={agentSettings.handleSettingsSubmit}
      onThemeModeChange={agentSettings.handleThemeModeChange}
    />
  );
}
