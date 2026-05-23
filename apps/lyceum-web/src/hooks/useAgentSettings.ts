import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AgentKeyRecord, AgentProviderRecord, ThemeMode } from "../courseTypes";

export function useAgentSettings(routeKind: string, apiBase: string) {
  const [agentProviders, setAgentProviders] = useState<AgentProviderRecord[]>([]);
  const [agentProviderId, setAgentProviderId] = useState("openai");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [agentKeys, setAgentKeys] = useState<AgentKeyRecord[]>([]);
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<"idle" | "loading" | "invalid">("idle");
  const [settingsStatus, setSettingsStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const storedTheme = localStorage.getItem("lyceum-theme-mode");
    return storedTheme === "light" || storedTheme === "dark" || storedTheme === "auto" ? storedTheme : "auto";
  });

  const handleSettingsSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const trimmedKey = agentApiKey.trim();
    if (!agentProviderId) {
      setSettingsStatus("error");
      setSettingsMessage("Choose a provider before saving.");
      return;
    }
    if (!trimmedKey) {
      setSettingsStatus("error");
      setSettingsMessage("Enter an API key before saving.");
      return;
    }

    setApiKeySaveStatus("loading");
    setSettingsStatus("loading");
    setSettingsMessage("");

    try {
      const response = await fetch(`${apiBase}/v1/local/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: agentProviderId, agent_api_key: trimmedKey }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail ?? "Settings save failed");
      }

      const settings = await response.json();
      const activeKey = (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);
      setAgentApiKey("");
      setApiKeySaveStatus("idle");
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      setSettingsMessage(
        activeKey ? `${activeKey.provider_label} verified with ${activeKey.models?.length ?? 0} models.` : "API key verified."
      );
    } catch (err) {
      console.warn("Unable to save settings:", err);
      setAgentApiKey("");
      setApiKeySaveStatus("invalid");
      setSettingsStatus("error");
      setSettingsMessage("");
    }
  };

  const handleActivateAgentKey = async (keyId: string) => {
    setSettingsStatus("loading");
    setSettingsMessage("Switching active key...");

    try {
      const response = await fetch(`${apiBase}/v1/local/settings/active-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId }),
      });
      if (!response.ok) {
        throw new Error("Active key update failed");
      }

      const settings = await response.json();
      const activeKey = (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      setSettingsMessage(activeKey ? `${activeKey.provider_label} is now active.` : "Active key updated.");
    } catch (err) {
      console.warn("Unable to activate key:", err);
      setSettingsStatus("error");
      setSettingsMessage("Could not switch keys. Is the API running?");
    }
  };

  const handleAgentModelChange = async (keyId: string, model: string) => {
    setSettingsStatus("loading");
    setSettingsMessage("Updating model...");

    try {
      const response = await fetch(`${apiBase}/v1/local/settings/key-model`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId, model }),
      });
      if (!response.ok) {
        throw new Error("Model update failed");
      }

      const settings = await response.json();
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      setSettingsMessage(`Model set to ${model}.`);
    } catch (err) {
      console.warn("Unable to update model:", err);
      setSettingsStatus("error");
      setSettingsMessage("Could not update that model.");
    }
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem("lyceum-theme-mode", mode);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === "auto") {
      root.removeAttribute("data-theme");
      root.style.colorScheme = "light dark";
      return;
    }

    root.setAttribute("data-theme", themeMode);
    root.style.colorScheme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (routeKind !== "settings") {
      return;
    }

    let ignored = false;
    setSettingsStatus("loading");
    setSettingsMessage("Loading settings...");

    Promise.all([
      fetch(`${apiBase}/v1/local/ai/providers`).then((response) => {
        if (!response.ok) throw new Error("AI providers unavailable");
        return response.json();
      }),
      fetch(`${apiBase}/v1/local/settings`).then((response) => {
        if (!response.ok) throw new Error("Settings unavailable");
        return response.json();
      }),
    ])
      .then(([providers, settings]) => {
        if (ignored) return;
        const activeKey = (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);
        setSettingsStatus("idle");
        setAgentProviders(providers ?? []);
        setAgentProviderId((currentProviderId) => currentProviderId || providers?.[0]?.id || "openai");
        setAgentKeys(settings.agent_keys ?? []);
        setSettingsMessage(
          activeKey ? `${activeKey.provider_label} is active with ${activeKey.model ?? "no model selected"}.` : "No agent API key saved yet."
        );
      })
      .catch((err) => {
        if (ignored) return;
        console.warn("Unable to load settings:", err);
        setSettingsStatus("error");
        setSettingsMessage("");
      });

    return () => {
      ignored = true;
    };
  }, [routeKind, apiBase]);

  const isSavingAgentKey = apiKeySaveStatus === "loading";
  const canAddAgentKey = Boolean(agentProviderId && agentApiKey.trim()) && !isSavingAgentKey;

  return {
    agentProviders,
    agentProviderId,
    agentApiKey,
    agentKeys,
    apiKeySaveStatus,
    canAddAgentKey,
    settingsStatus,
    settingsMessage,
    themeMode,
    handleActivateAgentKey,
    handleAgentModelChange,
    handleSettingsSubmit,
    handleThemeModeChange,
    setAgentApiKey,
    setAgentProviderId,
    setApiKeySaveStatus,
  };
}
