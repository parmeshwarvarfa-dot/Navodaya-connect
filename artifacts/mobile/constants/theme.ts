export const theme = {
  typography: {
    fontFamily: {
      regular: "Inter_400Regular",
      medium: "Inter_500Medium",
      semibold: "Inter_600SemiBold",
      bold: "Inter_700Bold",
    },
  },
  colors: {
    primary: "#7C3AED",
    primaryDark: "#5B21B6",
    primaryMedium: "#6D28D9",
    primaryLight: "#DDD6FE",
    primarySoft: "#F5F3FF",
    lavenderSoft: "#EDE9FE",
    lavenderBorder: "#E9D5FF",

    background: "#F8F7FF",
    surface: "#FFFFFF",
    surfaceHover: "#FAF5FF",

    textPrimary: "#1E1B4B",
    textSecondary: "#64748B",
    textTertiary: "#94A3B8",
    textInverse: "#FFFFFF",

    accentPink: "#EC4899",
    accentEmerald: "#10B981",
    accentAmber: "#F59E0B",
    accentSky: "#0EA5E9",
    accentIndigo: "#6366F1",

    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",

    border: "#E9D5FF",
    borderSubtle: "#F1EDFF",
    divider: "#F1F5F9",
  },

  gradients: {
    hero: ["#8B5CF6", "#6D28D9"] as const,
    purpleRoyal: ["#6D28D9", "#5B21B6"] as const,
    purpleVibrant: ["#8B5CF6", "#6D28D9"] as const,
    purplePill: ["#9333EA", "#7C3AED"] as const,
    ambientBg: ["#EDE9FE", "#F5F3FF", "#FFFFFF"] as const,
    softCard: ["#FFFFFF", "#FAF5FF"] as const,
    glass: ["rgba(255, 255, 255, 0.95)", "rgba(245, 243, 255, 0.85)"] as const,
  },

  radius: {
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    pill: 9999,
  },

  shadows: {
    sm: {
      shadowColor: "#7C3AED",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    md: {
      shadowColor: "#7C3AED",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.10,
      shadowRadius: 16,
      elevation: 5,
    },
    lg: {
      shadowColor: "#7C3AED",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 10,
    },
    floatingBar: {
      shadowColor: "#7C3AED",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 16,
    },
  },
};

export default theme;
