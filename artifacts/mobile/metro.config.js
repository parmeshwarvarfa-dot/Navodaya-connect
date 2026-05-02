const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Include the monorepo root so Metro can resolve pnpm-hoisted packages
config.watchFolders = [workspaceRoot];

// Set the project root explicitly
config.projectRoot = projectRoot;

// Block Firebase temp files that crash the watcher
const { blockList: existingBlockList } = config.resolver || {};
const defaultBlockList = Array.isArray(existingBlockList)
  ? existingBlockList
  : existingBlockList
    ? [existingBlockList]
    : [];

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ],
  blockList: [
    ...defaultBlockList,
    // Exclude Firebase temp watch files
    new RegExp(`.*_tmp_\\d+$`),
  ],
};

module.exports = config;
