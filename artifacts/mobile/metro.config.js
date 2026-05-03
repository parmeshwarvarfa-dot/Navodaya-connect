const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Include the monorepo root so Metro can resolve pnpm-hoisted packages
config.watchFolders = [workspaceRoot];

// Set the project root explicitly
config.projectRoot = projectRoot;

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ],
};

module.exports = config;
