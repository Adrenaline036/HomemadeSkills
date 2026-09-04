#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [toolName, inputPath, outputPath] = process.argv.slice(2);
if (!toolName || !inputPath || !outputPath) throw new Error("Usage: node invoke-tool.mjs <tool-name> <input-json> <output-json>");
const userProfile = process.env.USERPROFILE || os.homedir();
const launcher = process.env.CODEX_DEEPSEEK_LAUNCHER || path.join(userProfile, ".codex", "automation", "deepseek-mcp", "start-deepseek-mcp.mjs");
const worker = path.join(userProfile, ".codex", "mcp", "deepseek-review-worker");
const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
const client = new Client({ name: "deepseek-review-acceptance-client", version: "1.0.0" }, { capabilities: {} });
const transport = new StdioClientTransport({ command: process.execPath, args: [launcher], cwd: worker, stderr: "inherit" });

try {
  await client.connect(transport);
  const result = await client.callTool({ name: toolName, arguments: input });
  const value = result.structuredContent ?? result;
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (result.isError) process.exitCode = 2;
} finally {
  await client.close();
}
