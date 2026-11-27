module.exports = ({ config }) => {
  const origin = process.env.EXPO_PUBLIC_APP_URL?.trim();
  const plugins = (config.plugins ?? []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "expo-router") return plugin;

    const options = { ...(plugin[1] ?? {}) };
    if (origin) {
      options.origin = origin;
    } else {
      delete options.origin;
    }

    return ["expo-router", options];
  });

  return { ...config, plugins };
};
