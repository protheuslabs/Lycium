export const brand = {
  product: "Lycium",
  platform: "Lycium",
} as const;

export const lyciumTokens = {
  color: {
    brandStart: "#0f5cff",
    brandEnd: "#7a35ff",
    darkCanvas: "#0b0b0c",
    darkSurface: "#171717",
    darkSurfaceRaised: "#1f1f22",
    darkText: "#f8fafc",
    darkMuted: "#a3a3a3",
    lightCanvas: "#ffffff",
    lightSurface: "#f7f8fb",
    lightSurfaceRaised: "#ffffff",
    lightText: "#171717",
    lightMuted: "#566070",
    success: "#22c55e",
    danger: "#ef4444",
    viewedProgress: "#9fb7ff",
    completedProgress: "#2563eb",
  },
  radius: {
    pill: "999px",
    card: "1.25rem",
    modal: "1.5rem",
  },
  shadow: {
    raised: "0 1.2rem 2.4rem rgba(22, 30, 52, 0.16)",
    darkRaised: "0 1.2rem 2.4rem rgba(0, 0, 0, 0.36)",
  },
} as const;

export const lyciumCssVariables = `
  --lycium-brand-start: ${lyciumTokens.color.brandStart};
  --lycium-brand-end: ${lyciumTokens.color.brandEnd};
  --lycium-dark-canvas: ${lyciumTokens.color.darkCanvas};
  --lycium-dark-surface: ${lyciumTokens.color.darkSurface};
  --lycium-dark-surface-raised: ${lyciumTokens.color.darkSurfaceRaised};
  --lycium-dark-text: ${lyciumTokens.color.darkText};
  --lycium-dark-muted: ${lyciumTokens.color.darkMuted};
  --lycium-light-canvas: ${lyciumTokens.color.lightCanvas};
  --lycium-light-surface: ${lyciumTokens.color.lightSurface};
  --lycium-light-surface-raised: ${lyciumTokens.color.lightSurfaceRaised};
  --lycium-light-text: ${lyciumTokens.color.lightText};
  --lycium-light-muted: ${lyciumTokens.color.lightMuted};
  --lycium-success: ${lyciumTokens.color.success};
  --lycium-danger: ${lyciumTokens.color.danger};
  --lycium-viewed-progress: ${lyciumTokens.color.viewedProgress};
  --lycium-completed-progress: ${lyciumTokens.color.completedProgress};
  --lycium-radius-pill: ${lyciumTokens.radius.pill};
  --lycium-radius-card: ${lyciumTokens.radius.card};
  --lycium-radius-modal: ${lyciumTokens.radius.modal};
  --lycium-shadow-raised: ${lyciumTokens.shadow.raised};
  --lycium-shadow-dark-raised: ${lyciumTokens.shadow.darkRaised};
`;
