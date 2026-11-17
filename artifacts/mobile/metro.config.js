const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const { createApiProxy } = require("./scripts/api-proxy.cjs");

const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Watch the shared packages and pnpm store without crawling unrelated apps,
// browser profiles, and exported preview builds in the workspace.
config.watchFolders = [
  path.resolve(workspaceRoot, "lib"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Set the project root explicitly
config.projectRoot = projectRoot;

config.resolver = {
  ...config.resolver,
  blockList: [
    ...(Array.isArray(config.resolver?.blockList) ? config.resolver.blockList : config.resolver?.blockList ? [config.resolver.blockList] : []),
    /[\\/](?:\.local|\.(?:chrome-avatar|edge-avatar|avatar-)[^\\/]*)(?:[\\/]|$)/,
    /[\\/]artifacts[\\/]mobile[\\/](?:dist|\.expo[\\/](?:alumni-peer-check(?:-android)?|web))(?:[\\/]|$)/,
  ],
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ],
};

const enhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware(middleware, server) {
    const next = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
    return createApiProxy(next, process.env.API_PROXY_TARGET || "http://127.0.0.1:3001");
  },
};

module.exports = config;
