const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude Firebase temp files that cause Metro watcher crashes
config.watchFolders = [];
config.resolver = {
  ...config.resolver,
  blockList: [
    /.*_tmp_\d+$/,
    /.*\/node_modules\/.pnpm\/@firebase.*_tmp_\d+.*/,
  ],
};

// Use polling watcher to avoid ENOENT crashes from firebase temp files
config.watcher = {
  ...config.watcher,
  healthCheck: {
    enabled: false,
  },
};

module.exports = config;
