#!/usr/bin/env node

// src/mcp-server.ts
import { once } from "node:events";
import { dirname as dirname3, isAbsolute, resolve as resolve3 } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";

// src/bridge.ts
import { execFile as execFile2 } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename as basename2, dirname as dirname2, join as join2, relative, resolve as resolve2 } from "node:path";
import { promisify as promisify2 } from "node:util";

// src/env.ts
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var XcodeError = class extends Error {
  code;
  constructor(message, code = "XCODE_ERROR") {
    super(message);
    this.name = "XcodeError";
    this.code = code;
  }
};
async function runCmd(file, args, timeoutMs = 8e3, signal) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      ...signal ? { signal } : {}
    });
    return { stdout: String(stdout), stderr: String(stderr), ok: true };
  } catch (error) {
    return {
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" ? error.stderr : error instanceof Error ? error.message : String(error),
      ok: false
    };
  }
}
function xcodeAppFromDeveloperDir(developerDir) {
  if (!developerDir) return void 0;
  const normalized = developerDir.replace(/\/+$/u, "");
  const marker = "/Contents/Developer";
  if (normalized.endsWith(marker)) {
    return normalized.slice(0, -marker.length);
  }
  if (normalized.endsWith(".app")) return normalized;
  return void 0;
}
function parseXcodebuildVersion(output) {
  const versionMatch = /^Xcode\s+([^\s\r\n]+)/mu.exec(output);
  if (!versionMatch) return void 0;
  const buildMatch = /^Build version\s+([^\s\r\n]+)/mu.exec(output);
  return {
    version: versionMatch[1],
    build: buildMatch?.[1] ?? "unknown"
  };
}
function parseRunningXcodeProcesses(psOutput) {
  const results = [];
  for (const rawLine of psOutput.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^(\d+)\s+(.+)$/u.exec(line);
    if (!match) continue;
    const pid = Number.parseInt(match[1], 10);
    const comm = match[2].trim();
    if (!Number.isSafeInteger(pid) || pid <= 0) continue;
    if (!/\/Contents\/MacOS\/Xcode$/u.test(comm)) continue;
    const appIndex = comm.lastIndexOf("/Contents/MacOS/Xcode");
    const appBundlePath = appIndex > 0 ? comm.slice(0, appIndex) : void 0;
    results.push({
      pid,
      executablePath: comm,
      ...appBundlePath ? { appBundlePath } : {}
    });
  }
  return results;
}
function pickXcodePid(options) {
  const { explicitPid, envPid, running, selectedAppPath } = options;
  if (explicitPid !== void 0 && Number.isSafeInteger(explicitPid) && explicitPid > 0) {
    return { pid: explicitPid, source: "explicit" };
  }
  if (envPid !== void 0 && Number.isSafeInteger(envPid) && envPid > 0) {
    return { pid: envPid, source: "env" };
  }
  if (running.length === 0) {
    return {
      reason: "No running Xcode process found. Open a project first with `xcode_open_project` (or launch Xcode manually)."
    };
  }
  if (running.length === 1) {
    return { pid: running[0].pid, source: "single" };
  }
  if (selectedAppPath) {
    const normalizedSelected = selectedAppPath.replace(/\/+$/u, "");
    const matches = running.filter((proc) => proc.appBundlePath?.replace(/\/+$/u, "") === normalizedSelected);
    if (matches.length === 1) {
      return { pid: matches[0].pid, source: "xcode-select" };
    }
  }
  const candidates = running.map((proc) => `${proc.pid} (${proc.appBundlePath ?? proc.executablePath})`).join(", ");
  return {
    reason: `Multiple Xcode processes are running (${candidates}). Pass \`xcodePid\` or configure \`xcodePid\` in cordis.patch.yml to select one.`
  };
}
async function inspectXcodeEnvironment(signal) {
  if (process.platform !== "darwin") {
    return {
      platform: process.platform,
      supportedPlatform: false,
      bridge: {
        available: false,
        supportsSkillsExport: false,
        supportsPluginPath: false,
        reason: `@zseven-w/dsh-xcode requires macOS with Xcode (current host: ${process.platform}).`
      },
      runningXcodes: []
    };
  }
  const envDevDir = process.env.DEVELOPER_DIR?.trim();
  const selectRes = envDevDir ? { ok: true, stdout: envDevDir, stderr: "" } : await runCmd("xcode-select", ["-p"], 5e3, signal);
  const developerDir = selectRes.ok ? selectRes.stdout.trim() : void 0;
  const selectedXcodeAppPath = xcodeAppFromDeveloperDir(developerDir);
  const [versionRes, bridgeFindRes, agentFindRes, psRes] = await Promise.all([
    runCmd("xcodebuild", ["-version"], 8e3, signal),
    runCmd("xcrun", ["--find", "mcpbridge"], 5e3, signal),
    runCmd("xcrun", ["--find", "agent"], 5e3, signal),
    runCmd("ps", ["-ax", "-o", "pid=,comm="], 5e3, signal)
  ]);
  const xcodeVersion = versionRes.ok ? parseXcodebuildVersion(versionRes.stdout) : void 0;
  const mcpbridgePath = bridgeFindRes.ok ? bridgeFindRes.stdout.trim() : void 0;
  const agentPath = agentFindRes.ok ? agentFindRes.stdout.trim() : void 0;
  const runningXcodes = psRes.ok ? parseRunningXcodeProcesses(psRes.stdout) : [];
  if (!mcpbridgePath) {
    return {
      platform: process.platform,
      supportedPlatform: true,
      ...developerDir ? { developerDir } : {},
      ...selectedXcodeAppPath ? { selectedXcodeAppPath } : {},
      ...xcodeVersion ? { xcodeVersion } : {},
      bridge: {
        available: false,
        supportsSkillsExport: false,
        supportsPluginPath: false,
        reason: developerDir?.includes("CommandLineTools") ? "xcode-select currently points to Command Line Tools (`" + developerDir + "`), not full Xcode. Run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` with Xcode 26.3+ installed." : "xcrun could not find `mcpbridge`. Install Xcode 26.3+ and point `xcode-select` to full Xcode.app."
      },
      runningXcodes
    };
  }
  const helpRes = await runCmd(mcpbridgePath, ["--help"], 5e3, signal);
  const helpText = `${helpRes.stdout}
${helpRes.stderr}`;
  const supportsSkillsExport = /skills\s+export/iu.test(helpText);
  const supportsPluginPath = /plugin\s+path/iu.test(helpText);
  return {
    platform: process.platform,
    supportedPlatform: true,
    ...developerDir ? { developerDir } : {},
    ...selectedXcodeAppPath ? { selectedXcodeAppPath } : {},
    ...xcodeVersion ? { xcodeVersion } : {},
    bridge: {
      available: true,
      mcpbridgePath,
      ...agentPath ? { agentPath } : {},
      supportsSkillsExport,
      supportsPluginPath
    },
    runningXcodes
  };
}
async function detectAppleProject(targetPath) {
  const abs = resolve(targetPath);
  let info;
  try {
    info = await stat(abs);
  } catch {
    throw new XcodeError(`Path does not exist: ${abs}`, "PATH_NOT_FOUND");
  }
  const ext = extname(abs).toLowerCase();
  if (ext === ".xcworkspace") {
    if (abs.includes(".xcodeproj/")) {
      const xcodeproj = dirname(abs);
      return {
        kind: "xcodeproj",
        openTargetPath: xcodeproj,
        rootDir: dirname(xcodeproj),
        name: basename(xcodeproj, ".xcodeproj")
      };
    }
    return {
      kind: "xcworkspace",
      openTargetPath: abs,
      rootDir: dirname(abs),
      name: basename(abs, ".xcworkspace")
    };
  }
  if (ext === ".xcodeproj") {
    return {
      kind: "xcodeproj",
      openTargetPath: abs,
      rootDir: dirname(abs),
      name: basename(abs, ".xcodeproj")
    };
  }
  if (basename(abs) === "Package.swift") {
    const dir = dirname(abs);
    return {
      kind: "swiftpm",
      openTargetPath: abs,
      rootDir: dir,
      name: basename(dir)
    };
  }
  const searchDir = info.isDirectory() ? abs : dirname(abs);
  const found = await scanDirForProject(searchDir);
  if (found) return found;
  const entries = await readdir(searchDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "DerivedData" || entry.name === "build") {
      continue;
    }
    const sub = await scanDirForProject(join(searchDir, entry.name));
    if (sub) return sub;
  }
  throw new XcodeError(
    `No .xcworkspace, .xcodeproj, or Package.swift found in ${searchDir}. Pass an explicit path to \`projectPath\`.`,
    "NO_APPLE_PROJECT"
  );
}
async function scanDirForProject(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const names = entries.map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
  const workspace = names.find((name) => name.endsWith(".xcworkspace") && !name.startsWith("."));
  if (workspace) {
    return {
      kind: "xcworkspace",
      openTargetPath: join(dir, workspace),
      rootDir: dir,
      name: basename(workspace, ".xcworkspace")
    };
  }
  const project = names.find((name) => name.endsWith(".xcodeproj") && !name.startsWith("."));
  if (project) {
    return {
      kind: "xcodeproj",
      openTargetPath: join(dir, project),
      rootDir: dir,
      name: basename(project, ".xcodeproj")
    };
  }
  if (names.includes("Package.swift")) {
    return {
      kind: "swiftpm",
      openTargetPath: join(dir, "Package.swift"),
      rootDir: dir,
      name: basename(dir)
    };
  }
  return void 0;
}

// src/mcp-stdio.ts
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
var DEFAULT_PROTOCOL_VERSION = "2025-06-18";
var HANDSHAKE_TIMEOUT_MS = 2e4;
var DEFAULT_CALL_TIMEOUT_MS = 12e4;
var MAX_LINE_BYTES = 64 * 1024 * 1024;
var MAX_IMAGE_BYTES = 20 * 1024 * 1024;
var MAX_IMAGES_PER_RESULT = 6;
var SENSITIVE_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN/iu;
var CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function scrubEnvForMcpBridge(sourceEnv = process.env, overrides = {}) {
  const clean = {};
  for (const [key, val] of Object.entries(sourceEnv)) {
    if (val === void 0) continue;
    if (key.startsWith("DSH_")) continue;
    if (SENSITIVE_ENV_PATTERN.test(key)) continue;
    clean[key] = val;
  }
  return { ...clean, ...overrides };
}
function enrichMcpBridgeError(rawMessage, xcodePid) {
  const text = rawMessage.trim();
  if (/no running Xcode processes found|No running Xcode found/iu.test(text)) {
    return new XcodeError(
      "Xcode is not running. Call `xcode_open_project` first (or launch Xcode and open your project).",
      "XCODE_NOT_RUNNING"
    );
  }
  if (/multiple Xcode processes found/iu.test(text)) {
    return new XcodeError(
      `Multiple Xcode instances are running and \`mcpbridge\` could not pick one automatically: ${text}`,
      "MULTIPLE_XCODE_INSTANCES"
    );
  }
  if (/Could not connect to Xcode|IntelligenceToolUse|denied|not authorized|permission|timed out waiting for connection/iu.test(text)) {
    return new XcodeError(
      `Could not establish MCP tool session with Xcode${xcodePid ? ` (PID ${xcodePid})` : ""}: ${text}. Ensure a project window is open in Xcode and external agents are enabled under Xcode \u2192 Settings \u2192 Intelligence \u2192 Model Context Protocol (Allow External Agents). If Xcode is showing an agent permission dialog, click Allow.`,
      "XCODE_PERMISSION_OR_SESSION"
    );
  }
  return new XcodeError(text || "xcrun mcpbridge terminated unexpectedly", "MCPBRIDGE_FAILED");
}
function decodeMcpImages(content) {
  const images = [];
  for (const block of content) {
    if (!isRecord(block) || block.type !== "image") continue;
    if (images.length >= MAX_IMAGES_PER_RESULT) {
      throw new XcodeError(`MCP tool returned more than ${MAX_IMAGES_PER_RESULT} images`, "IMAGE_LIMIT");
    }
    const mimeType = block.mimeType;
    const data = block.data;
    if (typeof mimeType !== "string" || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mimeType)) {
      throw new XcodeError(`Unsupported MCP image media type: ${String(mimeType)}`, "IMAGE_MIME");
    }
    if (typeof data !== "string" || data.length === 0 || !CANONICAL_BASE64.test(data)) {
      throw new XcodeError("MCP image block is not canonical base64", "IMAGE_BASE64");
    }
    const bytes = Buffer.from(data, "base64");
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      throw new XcodeError(`MCP image size (${bytes.length} bytes) is out of bounds`, "IMAGE_SIZE");
    }
    images.push({
      mimeType,
      bytes
    });
  }
  return images;
}
function stripLargeBase64Fields(value) {
  if (Array.isArray(value)) return value.map(stripLargeBase64Fields);
  if (!isRecord(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if ((k === "data" || k === "imageData" || k === "pngBase64" || k === "image_base64") && typeof v === "string" && v.length > 512) {
      out[k] = `[binary base64 omitted: ${v.length} chars]`;
      continue;
    }
    out[k] = stripLargeBase64Fields(v);
  }
  return out;
}
function normalizeMcpCallResult(tool, rawResult) {
  if (!isRecord(rawResult)) {
    throw new XcodeError(`Xcode MCP tool "${tool}" returned a non-object result`, "MCP_INVALID_RESULT");
  }
  const rawContent = Array.isArray(rawResult.content) ? rawResult.content : [];
  const textParts = [];
  for (const item of rawContent) {
    if (!isRecord(item)) continue;
    if (item.type === "text" && typeof item.text === "string") {
      textParts.push(item.text);
    } else if (item.type === "resource_link" && typeof item.uri === "string") {
      textParts.push(`Resource: ${typeof item.name === "string" ? item.name : item.uri} (${item.uri})`);
    } else if (item.type === "resource" && isRecord(item.resource) && typeof item.resource.text === "string") {
      textParts.push(item.resource.text);
    }
  }
  const combinedText = textParts.join("\n");
  if (rawResult.isError === true) {
    throw new XcodeError(
      `Xcode tool "${tool}" reported an error${combinedText ? `: ${combinedText}` : ""}`,
      "XCODE_TOOL_ERROR"
    );
  }
  const images = decodeMcpImages(rawContent);
  let structuredContent = rawResult.structuredContent;
  if (structuredContent === void 0 && textParts.length === 1) {
    const trimmed = textParts[0].trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}") || trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        structuredContent = stripLargeBase64Fields(JSON.parse(trimmed));
      } catch {
      }
    }
  } else if (structuredContent !== void 0) {
    structuredContent = stripLargeBase64Fields(structuredContent);
  }
  const sanitizedContent = rawContent.map((block) => {
    if (isRecord(block) && block.type === "image") {
      return { type: "image", mimeType: block.mimeType ?? "image/png" };
    }
    return stripLargeBase64Fields(block);
  });
  return {
    tool,
    text: combinedText,
    ...structuredContent !== void 0 ? { structuredContent } : {},
    images,
    rawContent: sanitizedContent
  };
}
var McpStdioSession = class {
  sessionId;
  xcodePid;
  command;
  args;
  handshakeTimeoutMs;
  defaultCallTimeoutMs;
  extraEnv;
  onToolsChanged;
  onClose;
  child = null;
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  stderrTail = "";
  closed = false;
  serverInfo;
  instructions;
  cachedTools = null;
  constructor(options = {}) {
    this.command = options.command ?? "xcrun";
    this.args = options.args ?? ["mcpbridge"];
    this.xcodePid = options.xcodePid;
    this.sessionId = options.sessionId ?? randomUUID();
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? HANDSHAKE_TIMEOUT_MS;
    this.defaultCallTimeoutMs = options.defaultCallTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
    this.extraEnv = options.extraEnv ?? {};
    this.onToolsChanged = options.onToolsChanged;
    this.onClose = options.onClose;
  }
  get isAlive() {
    return !this.closed && this.child !== null && this.child.exitCode === null && !this.child.killed;
  }
  getServerInfo() {
    return this.serverInfo;
  }
  getInstructions() {
    return this.instructions;
  }
  async connect(signal) {
    if (this.closed) throw new XcodeError("MCP session is already disposed", "SESSION_CLOSED");
    if (this.isAlive) return;
    const overrides = {
      MCP_XCODE_SESSION_ID: this.sessionId,
      ...this.extraEnv
    };
    if (this.xcodePid !== void 0) {
      overrides.MCP_XCODE_PID = String(this.xcodePid);
    }
    const child = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: scrubEnvForMcpBridge(process.env, overrides)
    });
    this.child = child;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-4096);
    });
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) {
        this.failAll(new XcodeError("MCP response exceeded maximum frame size", "FRAME_TOO_LARGE"));
        void this.close();
        return;
      }
      this.handleLine(line);
    });
    child.on("error", (err) => {
      const enriched = enrichMcpBridgeError(err.message, this.xcodePid);
      this.failAll(enriched);
      this.markClosed(enriched.message);
    });
    child.on("close", (code, sig) => {
      rl.close();
      const detail = this.stderrTail.trim() || `process exited (code=${String(code)}, signal=${String(sig)})`;
      const enriched = enrichMcpBridgeError(detail, this.xcodePid);
      this.failAll(enriched);
      this.markClosed(enriched.message);
    });
    const initResult = await this.request(
      "initialize",
      {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: "@zseven-w/dsh-xcode",
          version: "0.1.0-rc.3"
        }
      },
      this.handshakeTimeoutMs,
      signal
    );
    if (isRecord(initResult)) {
      if (isRecord(initResult.serverInfo)) this.serverInfo = initResult.serverInfo;
      if (typeof initResult.instructions === "string" && initResult.instructions.trim() !== "") {
        this.instructions = initResult.instructions.trim();
      }
    }
    this.notify("notifications/initialized", {});
  }
  async listTools(options = {}) {
    if (!options.refresh && this.cachedTools !== null) {
      return this.cachedTools;
    }
    const tools = [];
    let cursor;
    for (let page = 0; page < 20; page++) {
      const res = await this.request(
        "tools/list",
        cursor ? { cursor } : {},
        this.handshakeTimeoutMs,
        options.signal
      );
      if (!isRecord(res) || !Array.isArray(res.tools)) break;
      for (const item of res.tools) {
        if (!isRecord(item) || typeof item.name !== "string" || !item.name) continue;
        tools.push({
          name: item.name,
          ...typeof item.description === "string" ? { description: item.description } : {},
          inputSchema: isRecord(item.inputSchema) ? item.inputSchema : { type: "object", properties: {} },
          ...isRecord(item.outputSchema) ? { outputSchema: item.outputSchema } : {}
        });
      }
      cursor = typeof res.nextCursor === "string" && res.nextCursor.length > 0 ? res.nextCursor : void 0;
      if (!cursor) break;
    }
    this.cachedTools = tools;
    return tools;
  }
  async callTool(name, args = {}, options = {}) {
    const raw = await this.request(
      "tools/call",
      { name, arguments: args },
      options.timeoutMs ?? this.defaultCallTimeoutMs,
      options.signal
    );
    return normalizeMcpCallResult(name, raw);
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    this.failAll(new XcodeError("MCP session closed", "SESSION_CLOSED"));
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;
    await new Promise((resolveDone) => {
      const killTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
        }
        resolveDone();
      }, 1500);
      child.once("close", () => {
        clearTimeout(killTimer);
        resolveDone();
      });
      try {
        child.stdin.end();
        child.kill("SIGTERM");
      } catch {
        clearTimeout(killTimer);
        resolveDone();
      }
    });
  }
  notify(method, params) {
    if (!this.isAlive || !this.child) return;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method,
      ...params !== void 0 ? { params } : {}
    });
    this.child.stdin.write(`${payload}
`);
  }
  request(method, params, timeoutMs, signal) {
    if (!this.isAlive || !this.child) {
      return Promise.reject(enrichMcpBridgeError(this.stderrTail || "MCP session is not connected", this.xcodePid));
    }
    if (signal?.aborted) {
      return Promise.reject(new XcodeError(`Xcode MCP ${method} canceled`, "ABORTED"));
    }
    const id = this.nextId++;
    return new Promise((resolveReq, rejectReq) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        cleanupAbort?.();
        this.notify("notifications/cancelled", { requestId: id, reason: "timeout" });
        rejectReq(
          enrichMcpBridgeError(
            `Timed out after ${Math.round(timeoutMs / 1e3)}s waiting for Xcode MCP "${method}". ${this.stderrTail}`.trim(),
            this.xcodePid
          )
        );
      }, timeoutMs);
      let cleanupAbort;
      if (signal) {
        const onAbort = () => {
          clearTimeout(timer);
          this.pending.delete(id);
          this.notify("notifications/cancelled", { requestId: id, reason: "canceled" });
          rejectReq(new XcodeError(`Xcode MCP ${method} canceled`, "ABORTED"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        cleanupAbort = () => signal.removeEventListener("abort", onAbort);
      }
      this.pending.set(id, {
        method,
        resolve: resolveReq,
        reject: rejectReq,
        timer,
        cleanupAbort
      });
      const frame = JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params
      });
      this.child.stdin.write(`${frame}
`, (err) => {
        if (err) {
          clearTimeout(timer);
          cleanupAbort?.();
          this.pending.delete(id);
          rejectReq(enrichMcpBridgeError(err.message, this.xcodePid));
        }
      });
    });
  }
  handleLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (!isRecord(msg)) return;
    if (typeof msg.method === "string" && msg.id === void 0) {
      if (msg.method === "notifications/tools/list_changed") {
        this.cachedTools = null;
        this.onToolsChanged?.();
      }
      return;
    }
    if (msg.method === "ping" && (typeof msg.id === "number" || typeof msg.id === "string")) {
      if (this.isAlive && this.child) {
        this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: {} })}
`);
      }
      return;
    }
    if (typeof msg.id !== "number") return;
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    this.pending.delete(msg.id);
    clearTimeout(entry.timer);
    entry.cleanupAbort?.();
    if (isRecord(msg.error)) {
      const errText = typeof msg.error.message === "string" ? msg.error.message : JSON.stringify(msg.error);
      entry.reject(enrichMcpBridgeError(`Xcode MCP ${entry.method} failed: ${errText}`, this.xcodePid));
      return;
    }
    entry.resolve(msg.result);
  }
  failAll(error) {
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      entry.cleanupAbort?.();
      entry.reject(error);
      this.pending.delete(id);
    }
  }
  markClosed(reason) {
    if (this.closed) return;
    this.closed = true;
    this.child = null;
    this.onClose?.(reason);
  }
};

// src/peer-registry.ts
var APPLE_PEER_SYMBOL = Symbol.for("zseven.dsh.apple.peer.v1");
function registry() {
  const host = globalThis;
  const existing = host[APPLE_PEER_SYMBOL];
  if (typeof existing === "object" && existing !== null) {
    return existing;
  }
  const created = {};
  host[APPLE_PEER_SYMBOL] = created;
  return created;
}
function readIosPeer() {
  try {
    return registry().ios?.() ?? null;
  } catch {
    return null;
  }
}

// src/bridge.ts
var execFileAsync2 = promisify2(execFile2);
var WORKBENCH_DIR_NAME = ".dsh-xcode";
var WORKBENCH_STATE_FILE = ".dsh-xcode/state.json";
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseXcodeWindows(result) {
  const windows = [];
  const seen = /* @__PURE__ */ new Set();
  const pushWindow = (candidate) => {
    const id = candidate.tabIdentifier?.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    windows.push({
      tabIdentifier: id,
      ...candidate.workspacePath ? { workspacePath: candidate.workspacePath } : {},
      ...candidate.name ? { name: candidate.name } : {},
      ...candidate.active !== void 0 ? { active: candidate.active } : {}
    });
  };
  const inspectStructured = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) inspectStructured(item);
      return;
    }
    if (!isRecord2(node)) return;
    const tabId = typeof node.tabIdentifier === "string" ? node.tabIdentifier : typeof node.tabId === "string" ? node.tabId : typeof node.identifier === "string" && ("workspacePath" in node || "documentPath" in node || "projectPath" in node) ? node.identifier : void 0;
    const wsPath = typeof node.workspacePath === "string" ? node.workspacePath : typeof node.projectPath === "string" ? node.projectPath : typeof node.documentPath === "string" ? node.documentPath : typeof node.path === "string" ? node.path : void 0;
    const name = typeof node.name === "string" ? node.name : typeof node.title === "string" ? node.title : wsPath ? basename2(wsPath) : void 0;
    if (tabId) {
      pushWindow({
        tabIdentifier: tabId,
        ...wsPath ? { workspacePath: wsPath } : {},
        ...name ? { name } : {},
        ...typeof node.isActive === "boolean" ? { active: node.isActive } : typeof node.active === "boolean" ? { active: node.active } : {}
      });
    }
    for (const val of Object.values(node)) {
      if (typeof val === "object" && val !== null) inspectStructured(val);
    }
  };
  if (result.structuredContent !== void 0) {
    inspectStructured(result.structuredContent);
  }
  if (windows.length === 0 && result.text.trim()) {
    try {
      inspectStructured(JSON.parse(result.text));
    } catch {
      const lines = result.text.split(/\r?\n/u);
      let currentTab;
      let currentPath;
      let currentName;
      const flush = () => {
        if (currentTab) {
          pushWindow({
            tabIdentifier: currentTab,
            ...currentPath ? { workspacePath: currentPath } : {},
            ...currentName ? { name: currentName } : currentPath ? { name: basename2(currentPath) } : {}
          });
        }
        currentTab = void 0;
        currentPath = void 0;
        currentName = void 0;
      };
      for (const line of lines) {
        const tabMatch = /tabIdentifier["'\s:=]+([A-Za-z0-9_.:-]+)/iu.exec(line);
        const pathMatch = /(?:workspacePath|projectPath|documentPath|path)["'\s:=]+([^\r\n,"'}]+)/iu.exec(line);
        const nameMatch = /(?:windowName|title|name)["'\s:=]+([^\r\n,"'}]+)/iu.exec(line);
        if (tabMatch) {
          if (currentTab && currentTab !== tabMatch[1]) flush();
          currentTab = tabMatch[1].trim();
        }
        if (pathMatch) currentPath = pathMatch[1].trim();
        if (nameMatch) currentName = nameMatch[1].trim();
        if (currentTab && currentPath && line.includes(",")) flush();
      }
      flush();
    }
  }
  return windows;
}
function extractDiagnosticItems(result) {
  const items = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const el of node) walk(el);
      return;
    }
    if (!isRecord2(node)) return;
    const msg = typeof node.message === "string" ? node.message : typeof node.title === "string" && ("severity" in node || "line" in node || "filePath" in node) ? node.title : void 0;
    if (msg) {
      const rawSev = String(node.severity ?? node.kind ?? node.type ?? "error").toLowerCase();
      const severity = rawSev.includes("warn") ? "warning" : rawSev.includes("note") || rawSev.includes("remark") ? "note" : "error";
      const file = typeof node.filePath === "string" ? node.filePath : typeof node.file === "string" ? node.file : typeof node.path === "string" ? node.path : void 0;
      const line = typeof node.line === "number" ? node.line : typeof node.lineNumber === "number" ? node.lineNumber : void 0;
      items.push({
        severity,
        ...file ? { file } : {},
        ...line !== void 0 ? { line } : {},
        message: msg
      });
    }
    for (const val of Object.values(node)) {
      if (typeof val === "object" && val !== null) walk(val);
    }
  };
  if (result.structuredContent !== void 0) walk(result.structuredContent);
  if (items.length === 0 && result.text) {
    for (const rawLine of result.text.split(/\r?\n/u)) {
      const m = /^(.+?):(\d+)(?::\d+)?:\s*(error|warning|note):\s*(.+)$/iu.exec(rawLine.trim());
      if (!m) continue;
      const sev = m[3].toLowerCase();
      items.push({
        severity: sev,
        file: m[1].trim(),
        line: Number.parseInt(m[2], 10),
        message: m[4].trim()
      });
    }
  }
  return items.slice(0, 100);
}
function normalizePathForMatch(p) {
  return resolve2(p).replace(/\/+$/u, "").toLowerCase();
}
var XcodeBridgeController = class {
  configuredPid;
  callTimeoutMs;
  bridgeCommand;
  bridgeArgs;
  inspectEnvFn;
  session = null;
  sessionPid;
  connecting = null;
  lastWindows = [];
  lastTools = [];
  lastEnv = null;
  exportedSkillsList = [];
  previewsHistory = [];
  lastDiagnosticsState;
  lastBuildState;
  lastErrorText;
  constructor(options = {}) {
    this.configuredPid = options.xcodePid;
    this.callTimeoutMs = options.callTimeoutMs ?? 18e4;
    this.bridgeCommand = options.bridgeCommand;
    this.bridgeArgs = options.bridgeArgs;
    this.inspectEnvFn = options.inspectEnv ?? inspectXcodeEnvironment;
  }
  setExportedSkillNames(names) {
    this.exportedSkillsList = [...names];
  }
  peerSnapshot() {
    return {
      version: "0.1.0-rc.3",
      connected: this.session?.isAlive === true,
      mcpbridgeAvailable: this.lastEnv?.bridge.available ?? process.platform === "darwin",
      ...this.lastEnv?.xcodeVersion?.version ? { xcodeVersion: this.lastEnv.xcodeVersion.version } : {},
      ...this.lastEnv?.xcodeVersion?.build ? { xcodeBuild: this.lastEnv.xcodeVersion.build } : {},
      ...this.sessionPid !== void 0 ? { xcodePid: this.sessionPid } : {},
      openWindows: this.lastWindows.map((w) => ({
        tabIdentifier: w.tabIdentifier,
        ...w.workspacePath ? { workspacePath: w.workspacePath } : {},
        ...w.name ? { name: w.name } : {}
      }))
    };
  }
  resolveEnvPid() {
    const raw = process.env.DSHPLUGIN_XCODE_PID ?? process.env.MCP_XCODE_PID;
    if (!raw) return void 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : void 0;
  }
  async ensureSession(options = {}) {
    const env = await this.inspectEnvFn(options.signal);
    this.lastEnv = env;
    if (!this.bridgeCommand) {
      if (!env.supportedPlatform || !env.bridge.available) {
        throw new XcodeError(env.bridge.reason ?? "Xcode mcpbridge is unavailable on this machine.", "BRIDGE_UNAVAILABLE");
      }
    }
    const picked = this.bridgeCommand ? { pid: options.xcodePid ?? this.configuredPid ?? 1, source: "explicit" } : pickXcodePid({
      explicitPid: options.xcodePid ?? this.configuredPid,
      envPid: this.resolveEnvPid(),
      running: env.runningXcodes,
      selectedAppPath: env.selectedXcodeAppPath
    });
    if (picked.pid === void 0) {
      throw new XcodeError(picked.reason ?? "No running Xcode process found.", "XCODE_NOT_RUNNING");
    }
    if (this.session?.isAlive && this.sessionPid === picked.pid) {
      return this.session;
    }
    if (this.connecting) {
      return this.connecting;
    }
    const connectTask = (async () => {
      if (this.session) {
        await this.session.close().catch(() => {
        });
        this.session = null;
      }
      const next = new McpStdioSession({
        ...this.bridgeCommand ? { command: this.bridgeCommand } : {},
        ...this.bridgeArgs ? { args: this.bridgeArgs } : {},
        ...this.bridgeCommand ? {} : { xcodePid: picked.pid },
        defaultCallTimeoutMs: this.callTimeoutMs,
        onClose: (reason) => {
          if (this.session === next) {
            this.session = null;
            this.lastErrorText = reason;
          }
        }
      });
      await next.connect(options.signal);
      const tools = await next.listTools({ signal: options.signal });
      this.session = next;
      this.sessionPid = picked.pid;
      this.lastTools = tools;
      this.lastErrorText = void 0;
      return next;
    })();
    this.connecting = connectTask;
    try {
      return await connectTask;
    } finally {
      this.connecting = null;
    }
  }
  async status(options = {}) {
    const env = await this.inspectEnvFn(options.signal);
    this.lastEnv = env;
    const iosPeer = readIosPeer();
    const canConnect = options.connectIfRunning !== false && (Boolean(this.bridgeCommand) || env.supportedPlatform && env.bridge.available && env.runningXcodes.length > 0);
    let connectionError;
    if (canConnect) {
      try {
        const session = await this.ensureSession({ signal: options.signal });
        this.lastTools = await session.listTools({ signal: options.signal });
        if (this.lastTools.some((t) => t.name === "XcodeListWindows")) {
          const winRes = await session.callTool("XcodeListWindows", {}, { timeoutMs: 15e3, signal: options.signal });
          this.lastWindows = parseXcodeWindows(winRes);
        }
      } catch (err) {
        connectionError = err instanceof Error ? err.message : String(err);
        this.lastErrorText = connectionError;
      }
    }
    const connected = this.session?.isAlive === true;
    const snapshot = {
      platform: env.platform,
      supportedPlatform: env.supportedPlatform,
      ...env.developerDir ? { developerDir: env.developerDir } : {},
      ...env.selectedXcodeAppPath ? { selectedXcodeAppPath: env.selectedXcodeAppPath } : {},
      ...env.xcodeVersion ? { xcodeVersion: env.xcodeVersion } : {},
      bridge: env.bridge,
      runningXcodes: env.runningXcodes,
      connected,
      ...this.sessionPid !== void 0 ? { xcodePid: this.sessionPid } : {},
      openWindows: this.lastWindows,
      availableTools: this.lastTools.map((t) => t.name),
      exportedSkills: this.exportedSkillsList,
      iosPeer,
      ...connectionError ? { connectionError } : {},
      setupHint: !connected ? "Open your project in Xcode (`xcode_open_project`) and enable Xcode \u2192 Settings \u2192 Intelligence \u2192 Model Context Protocol \u2192 Allow External Agents." : void 0
    };
    if (options.cwd) {
      await this.persistWorkbenchState(options.cwd).catch(() => {
      });
    }
    return snapshot;
  }
  async listWindows(options = {}) {
    const session = await this.ensureSession(options);
    const res = await session.callTool("XcodeListWindows", {}, { timeoutMs: 15e3, signal: options.signal });
    const parsed = parseXcodeWindows(res);
    this.lastWindows = parsed;
    return parsed;
  }
  /**
   * Resolve a `tabIdentifier` automatically when the caller omits it:
   * 1. Explicit `tabIdentifier` wins immediately.
   * 2. Match `projectPath` (or containing rootDir) against `openWindows`.
   * 3. Single open window wins automatically.
   * 4. Active window wins if marked active; otherwise error listing candidates.
   */
  async resolveTabIdentifier(options) {
    if (options.tabIdentifier && options.tabIdentifier.trim() !== "") {
      return options.tabIdentifier.trim();
    }
    const windows = await this.listWindows({ xcodePid: options.xcodePid, signal: options.signal });
    if (windows.length === 0) {
      throw new XcodeError(
        "Xcode is running, but no open project window was reported by `XcodeListWindows`. Call `xcode_open_project` to open an `.xcworkspace`, `.xcodeproj`, or `Package.swift` first.",
        "NO_OPEN_XCODE_WINDOW"
      );
    }
    if (options.projectPath && options.projectPath.trim() !== "") {
      const targetNorm = normalizePathForMatch(options.projectPath);
      const targetBase = basename2(targetNorm);
      const exactOrContained = windows.find((win) => {
        if (!win.workspacePath) return false;
        const winNorm = normalizePathForMatch(win.workspacePath);
        const winDir = dirname2(winNorm);
        return winNorm === targetNorm || targetNorm.startsWith(`${winNorm}/`) || targetNorm.startsWith(`${winDir}/`) || winNorm.startsWith(`${targetNorm}/`);
      });
      if (exactOrContained) return exactOrContained.tabIdentifier;
      const byName = windows.find((win) => win.name?.toLowerCase() === targetBase);
      if (byName) return byName.tabIdentifier;
    }
    if (windows.length === 1) {
      return windows[0].tabIdentifier;
    }
    const active = windows.find((w) => w.active === true);
    if (active) return active.tabIdentifier;
    const choices = windows.map((w) => `${w.tabIdentifier} (${w.workspacePath ?? w.name ?? "untitled"})`).join(", ");
    throw new XcodeError(
      `Multiple Xcode windows are open (${choices}). Pass \`tabIdentifier\` or \`projectPath\` to disambiguate.`,
      "AMBIGUOUS_TAB_IDENTIFIER"
    );
  }
  async openProject(options) {
    const searchTarget = options.projectPath?.trim() ? resolve2(options.cwd, options.projectPath.trim()) : options.cwd;
    const detected = await detectAppleProject(searchTarget);
    if (!this.bridgeCommand) {
      const env = await this.inspectEnvFn(options.signal);
      this.lastEnv = env;
      if (!env.supportedPlatform || !env.bridge.available) {
        throw new XcodeError(env.bridge.reason ?? "Xcode is not available on this host.", "BRIDGE_UNAVAILABLE");
      }
      const appTarget = env.selectedXcodeAppPath ?? "Xcode";
      await execFileAsync2("open", ["-a", appTarget, detected.openTargetPath], {
        timeout: 1e4,
        ...options.signal ? { signal: options.signal } : {}
      });
    }
    const maxWaitMs = Math.min(6e4, Math.max(2e3, (options.waitSeconds ?? 20) * 1e3));
    const deadline = Date.now() + maxWaitMs;
    let lastErr;
    while (Date.now() < deadline) {
      if (options.signal?.aborted) throw new XcodeError("xcode_open_project canceled", "ABORTED");
      try {
        const windows = await this.listWindows({ signal: options.signal });
        if (windows.length > 0) {
          let tabId;
          try {
            tabId = await this.resolveTabIdentifier({
              projectPath: detected.openTargetPath,
              signal: options.signal
            });
          } catch {
            tabId = windows[0]?.tabIdentifier;
          }
          await this.persistWorkbenchState(options.cwd).catch(() => {
          });
          return {
            detected,
            connected: true,
            ...this.sessionPid !== void 0 ? { xcodePid: this.sessionPid } : {},
            ...tabId ? { tabIdentifier: tabId } : {},
            openWindows: windows
          };
        }
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
      await new Promise((r) => setTimeout(r, this.bridgeCommand ? 50 : 1200));
    }
    await this.persistWorkbenchState(options.cwd).catch(() => {
    });
    return {
      detected,
      connected: false,
      ...this.sessionPid !== void 0 ? { xcodePid: this.sessionPid } : {},
      openWindows: this.lastWindows,
      note: lastErr ?? "Opened project in Xcode, waiting for MCP bridge authorization. Check Xcode for an external-agent permission prompt (Settings \u2192 Intelligence \u2192 Allow External Agents)."
    };
  }
  async diagnostics(options) {
    const session = await this.ensureSession({ signal: options.signal });
    const tools = await session.listTools({ signal: options.signal });
    const tabIdentifier = await this.resolveTabIdentifier({
      tabIdentifier: options.tabIdentifier,
      projectPath: options.projectPath ?? options.filePath ?? options.cwd,
      signal: options.signal
    });
    let res;
    let mode;
    if (options.filePath && tools.some((t) => t.name === "XcodeRefreshCodeIssuesInFile")) {
      mode = "file";
      const absFile = resolve2(options.cwd, options.filePath);
      res = await session.callTool(
        "XcodeRefreshCodeIssuesInFile",
        { tabIdentifier, filePath: absFile },
        { timeoutMs: 45e3, signal: options.signal }
      );
    } else if (tools.some((t) => t.name === "XcodeListNavigatorIssues")) {
      mode = "navigator";
      res = await session.callTool(
        "XcodeListNavigatorIssues",
        {
          tabIdentifier,
          ...options.severity ? { severity: options.severity } : {},
          ...options.pattern ? { pattern: options.pattern } : {}
        },
        { timeoutMs: 3e4, signal: options.signal }
      );
    } else {
      mode = "build-log";
      res = await session.callTool(
        "GetBuildLog",
        {
          tabIdentifier,
          ...options.severity ? { severity: options.severity } : {},
          ...options.pattern ? { pattern: options.pattern } : {}
        },
        { timeoutMs: 3e4, signal: options.signal }
      );
    }
    const items = extractDiagnosticItems(res);
    this.lastDiagnosticsState = {
      checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...options.filePath ? { target: options.filePath } : {},
      items,
      rawText: res.text.slice(0, 8e3)
    };
    await this.persistWorkbenchState(options.cwd).catch(() => {
    });
    return {
      mode,
      tabIdentifier,
      issueCount: items.length,
      items,
      ...res.structuredContent !== void 0 ? { structured: res.structuredContent } : {},
      text: res.text
    };
  }
  async buildOrTest(options) {
    const session = await this.ensureSession({ signal: options.signal });
    const tabIdentifier = await this.resolveTabIdentifier({
      tabIdentifier: options.tabIdentifier,
      projectPath: options.projectPath ?? options.cwd,
      signal: options.signal
    });
    const toolMap = {
      build: "BuildProject",
      build_log: "GetBuildLog",
      list_tests: "GetTestList",
      run_all_tests: "RunAllTests",
      run_some_tests: "RunSomeTests"
    };
    const rawTool = toolMap[options.action];
    const callArgs = { tabIdentifier };
    if (options.action === "run_some_tests" && Array.isArray(options.tests)) {
      callArgs.tests = options.tests;
    }
    if (options.action === "build_log") {
      if (options.severity) callArgs.severity = options.severity;
      if (options.pattern) callArgs.pattern = options.pattern;
    }
    const res = await session.callTool(rawTool, callArgs, {
      timeoutMs: this.callTimeoutMs,
      signal: options.signal
    });
    const issues = extractDiagnosticItems(res);
    const hasErrors = issues.some((i) => i.severity === "error") || /\bBUILD FAILED\b/iu.test(res.text);
    this.lastBuildState = {
      finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
      action: options.action,
      ok: !hasErrors,
      summary: res.text.slice(0, 600) || (res.structuredContent ? JSON.stringify(res.structuredContent).slice(0, 600) : "Completed")
    };
    await this.persistWorkbenchState(options.cwd).catch(() => {
    });
    return {
      action: options.action,
      tool: rawTool,
      tabIdentifier,
      ok: !hasErrors,
      issueCount: issues.length,
      issues: issues.slice(0, 50),
      ...res.structuredContent !== void 0 ? { structured: res.structuredContent } : {},
      text: res.text
    };
  }
  async renderPreview(options) {
    const session = await this.ensureSession({ signal: options.signal });
    const absSource = resolve2(options.cwd, options.sourceFilePath);
    const tabIdentifier = await this.resolveTabIdentifier({
      tabIdentifier: options.tabIdentifier,
      projectPath: options.projectPath ?? absSource,
      signal: options.signal
    });
    const args = {
      tabIdentifier,
      sourceFilePath: absSource
    };
    if (options.previewDefinitionIndexInFile !== void 0) {
      args.previewDefinitionIndexInFile = options.previewDefinitionIndexInFile;
    }
    const res = await session.callTool("RenderPreview", args, {
      timeoutMs: Math.max(12e4, this.callTimeoutMs),
      signal: options.signal
    });
    const previewsDir = join2(options.cwd, WORKBENCH_DIR_NAME, "previews");
    await mkdir(previewsDir, { recursive: true });
    const saved = [];
    const stamp = Date.now();
    const baseSlug = basename2(absSource).replace(/[^A-Za-z0-9._-]+/gu, "_");
    for (const [idx, img] of res.images.entries()) {
      const ext = img.mimeType === "image/jpeg" ? "jpg" : img.mimeType === "image/webp" ? "webp" : "png";
      const fileName = `${stamp}-${idx}-${baseSlug}.${ext}`;
      const absOut = join2(previewsDir, fileName);
      await writeFile(absOut, img.bytes);
      const relOut = relative(options.cwd, absOut).split("\\").join("/");
      const rec = {
        id: `${stamp}-${idx}`,
        sourceFilePath: absSource,
        relativeImagePath: relOut,
        absoluteImagePath: absOut,
        mimeType: img.mimeType,
        bytes: img.bytes.length,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      saved.push(rec);
    }
    if (saved.length > 0) {
      this.previewsHistory = [...saved, ...this.previewsHistory].slice(0, 12);
    }
    await this.persistWorkbenchState(options.cwd).catch(() => {
    });
    return {
      tabIdentifier,
      sourceFilePath: absSource,
      savedPreviews: saved,
      images: res.images,
      text: res.text,
      ...res.structuredContent !== void 0 ? { structured: res.structuredContent } : {}
    };
  }
  async searchDocs(options) {
    const session = await this.ensureSession({ signal: options.signal });
    const args = { query: options.query };
    if (options.frameworks && options.frameworks.length > 0) {
      args.frameworks = options.frameworks;
    }
    const res = await session.callTool("DocumentationSearch", args, {
      timeoutMs: 3e4,
      signal: options.signal
    });
    return {
      query: options.query,
      ...res.structuredContent !== void 0 ? { structured: res.structuredContent } : {},
      text: res.text
    };
  }
  async listOrCallRawTool(options) {
    const session = await this.ensureSession({ signal: options.signal });
    if (options.action === "list") {
      const tools = await session.listTools({ refresh: true, signal: options.signal });
      this.lastTools = tools;
      if (options.cwd) await this.persistWorkbenchState(options.cwd).catch(() => {
      });
      return {
        count: tools.length,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description ?? "",
          inputSchema: t.inputSchema
        }))
      };
    }
    if (!options.toolName || options.toolName.trim() === "") {
      throw new XcodeError('`toolName` is required when `action` is "call".', "MISSING_TOOL_NAME");
    }
    const res = await session.callTool(options.toolName.trim(), options.arguments ?? {}, {
      timeoutMs: this.callTimeoutMs,
      signal: options.signal
    });
    if (options.cwd) await this.persistWorkbenchState(options.cwd).catch(() => {
    });
    return res;
  }
  async persistWorkbenchState(cwd) {
    const dir = join2(cwd, WORKBENCH_DIR_NAME);
    await mkdir(dir, { recursive: true });
    const state = {
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...this.lastEnv?.xcodeVersion?.version ? { xcodeVersion: this.lastEnv.xcodeVersion.version } : {},
      ...this.lastEnv?.xcodeVersion?.build ? { xcodeBuild: this.lastEnv.xcodeVersion.build } : {},
      connected: this.session?.isAlive === true,
      ...this.sessionPid !== void 0 ? { xcodePid: this.sessionPid } : {},
      openWindows: this.lastWindows,
      availableTools: this.lastTools.map((t) => t.name),
      exportedSkills: this.exportedSkillsList,
      iosPeer: readIosPeer(),
      ...this.lastDiagnosticsState ? { lastDiagnostics: this.lastDiagnosticsState } : {},
      ...this.lastBuildState ? { lastBuild: this.lastBuildState } : {},
      previews: this.previewsHistory,
      ...this.lastErrorText ? { lastError: this.lastErrorText } : {}
    };
    await writeFile(join2(cwd, WORKBENCH_STATE_FILE), JSON.stringify(state, null, 2));
    return state;
  }
  async dispose() {
    if (this.session) {
      await this.session.close().catch(() => {
      });
      this.session = null;
    }
  }
};

// src/skills.ts
import { execFile as execFile3 } from "node:child_process";
import { mkdir as mkdir2, readdir as readdir2, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join as join3 } from "node:path";
import { promisify as promisify3 } from "node:util";
var execFileAsync3 = promisify3(execFile3);
function defaultSkillsCacheRoot() {
  return join3(homedir(), ".cache", "dsh-xcode", "skills");
}
function parseSkillMarkdown(raw, fallbackName) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw);
  if (!match) {
    return {
      name: fallbackName,
      description: `Apple official Xcode skill (${fallbackName})`,
      body: raw.trim()
    };
  }
  const frontmatter = match[1];
  const body = match[2].trim();
  let name = fallbackName;
  let description = `Apple official Xcode skill (${fallbackName})`;
  for (const line of frontmatter.split(/\r?\n/u)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.+)$/u.exec(line.trim());
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const val = kv[2].trim().replace(/^["']|["']$/gu, "");
    if (key === "name" && val) name = val;
    if (key === "description" && val) description = val;
  }
  return { name, description, body: body || raw.trim() };
}
function sanitizeSkillId(raw) {
  const slug = raw.toLowerCase().replace(/[^a-z0-9-]+/gu, "-").replace(/^-+|-+$/gu, "");
  const clean = slug || "skill";
  return clean.startsWith("xcode-") ? clean : `xcode-${clean}`;
}
async function loadCachedAppleSkills(cacheDir) {
  const entries = await readdir2(cacheDir, { withFileTypes: true }).catch(() => []);
  const skills = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const skillFilePath = join3(cacheDir, entry.name, "SKILL.md");
    let raw;
    try {
      raw = await readFile(skillFilePath, "utf8");
    } catch {
      continue;
    }
    const parsed = parseSkillMarkdown(raw, entry.name);
    skills.push({
      dirName: entry.name,
      registeredName: sanitizeSkillId(parsed.name),
      title: parsed.name,
      description: parsed.description,
      skillFilePath,
      content: parsed.body
    });
  }
  return skills;
}
async function exportAppleSkillsFromXcode(options) {
  const buildTag = (options.xcodeBuild ?? "default").replace(/[^A-Za-z0-9._-]+/gu, "_");
  const outputDir = join3(options.cacheRoot ?? defaultSkillsCacheRoot(), buildTag);
  await mkdir2(outputDir, { recursive: true });
  const command = options.command ?? "xcrun";
  const args = [
    ...options.argsPrefix ?? ["agent", "skills", "export"],
    "--output-dir",
    outputDir,
    "--replace-existing"
  ];
  const overrides = {};
  if (options.xcodePid !== void 0) {
    overrides.MCP_XCODE_PID = String(options.xcodePid);
  }
  let stdout = "";
  try {
    const res = await execFileAsync3(command, args, {
      timeout: 25e3,
      maxBuffer: 4 * 1024 * 1024,
      env: scrubEnvForMcpBridge(process.env, overrides),
      ...options.signal ? { signal: options.signal } : {}
    });
    stdout = String(res.stdout ?? "").trim();
  } catch (error) {
    const detail = typeof error?.stderr === "string" && error.stderr.trim() ? error.stderr.trim() : error instanceof Error ? error.message : String(error);
    throw new XcodeError(
      `Failed to export Apple skills via \`xcrun agent skills export\`: ${detail}. Ensure Xcode is open with external agents allowed in Xcode \u2192 Settings \u2192 Intelligence.`,
      "SKILLS_EXPORT_FAILED"
    );
  }
  const skills = await loadCachedAppleSkills(outputDir);
  return { outputDir, skills, stdout };
}

// src/mcp-server.ts
var MCP_SERVER_NAME = "dsh-xcode";
var MCP_SERVER_VERSION = "0.1.0-rc.3";
var MAX_MESSAGE_BYTES = 32 * 1024 * 1024;
var workspaceDirProperty = {
  type: "string",
  description: "Optional absolute workspace directory path for resolving relative project/file paths."
};
var MCP_XCODE_TOOLS = [
  {
    name: "xcode_status",
    title: "Xcode Bridge Status",
    description: "Inspect local Xcode installation, `xcrun mcpbridge` availability, running Xcode PIDs, open workspace windows (`tabIdentifier`s), exposed Xcode MCP tools, synced Apple `SKILL.md` skills, and `@zseven-w/dsh-ios` peer device status. Call this first when starting an Apple/iOS/macOS task.",
    inputSchema: {
      type: "object",
      properties: {
        connect: {
          type: "boolean",
          description: "Connect to `xcrun mcpbridge` and query `XcodeListWindows` if Xcode is currently running. Default true."
        },
        workspaceDir: workspaceDirProperty
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "xcode_open_project",
    title: "Open Project in Xcode",
    description: "Open an `.xcworkspace`, `.xcodeproj`, or `Package.swift` in Xcode (auto-detecting from the workspace when `projectPath` is omitted) and wait until `xcrun mcpbridge` connects and reports its `tabIdentifier`.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to `.xcworkspace`, `.xcodeproj`, `Package.swift`, or directory containing one (relative to workspace or absolute). Optional."
        },
        waitSeconds: {
          type: "integer",
          description: "How long to wait (2\u201360 seconds) for Xcode to finish opening the window and establish MCP bridge access. Default 20."
        },
        workspaceDir: workspaceDirProperty
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
  },
  {
    name: "xcode_diagnostics",
    title: "Xcode Live Diagnostics",
    description: "Read live compiler errors and warnings directly from Xcode without running a cold `xcodebuild`. Pass `filePath` for instant single-file typechecking (`XcodeRefreshCodeIssuesInFile`), or omit `filePath` to list workspace-wide Issue Navigator diagnostics (`XcodeListNavigatorIssues` / `GetBuildLog`).",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Optional source file path (`.swift`, `.m`, `.mm`, `.h`) to refresh & check issues in that single file without a full build."
        },
        projectPath: {
          type: "string",
          description: "Optional `.xcodeproj` / `.xcworkspace` path when multiple Xcode windows are open."
        },
        tabIdentifier: {
          type: "string",
          description: "Optional explicit Xcode `tabIdentifier` from `xcode_status`; auto-resolved when omitted."
        },
        severity: {
          type: "string",
          enum: ["error", "warning", "remark"],
          description: "Optional minimum diagnostic severity filter."
        },
        pattern: {
          type: "string",
          description: "Optional regex/substring filter over file path or diagnostic message."
        },
        workspaceDir: workspaceDirProperty
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "xcode_build_test",
    title: "Xcode Build & Test",
    description: "Build the active Xcode scheme, read the latest build log, or discover/run XCTest & Swift Testing targets using Xcode's warm incremental build graph (`BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests`, `RunSomeTests`).",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["build", "build_log", "list_tests", "run_all_tests", "run_some_tests"],
          description: "Operation to run in Xcode."
        },
        tests: {
          type: "string",
          description: "For `run_some_tests`: JSON array string of test identifiers/specifiers as returned by `list_tests`."
        },
        projectPath: {
          type: "string",
          description: "Optional `.xcodeproj` / `.xcworkspace` path when multiple Xcode windows are open."
        },
        tabIdentifier: {
          type: "string",
          description: "Optional explicit Xcode `tabIdentifier`; auto-resolved when omitted."
        },
        severity: {
          type: "string",
          enum: ["error", "warning", "remark"],
          description: "Optional filter for `build_log`."
        },
        pattern: {
          type: "string",
          description: "Optional text/regex filter for `build_log`."
        },
        workspaceDir: workspaceDirProperty
      },
      required: ["action"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
  },
  {
    name: "xcode_render_preview",
    title: "Render SwiftUI #Preview",
    description: "Render a SwiftUI `#Preview` or `PreviewProvider` snapshot natively inside Xcode (`RenderPreview`). Works for both `.xcodeproj`/`.xcworkspace` app targets and Swift packages, saves the PNG into `.dsh-xcode/previews/`, and returns the rendered image content block alongside metadata.",
    inputSchema: {
      type: "object",
      properties: {
        sourceFilePath: {
          type: "string",
          description: "Path to the Swift file containing `#Preview` or `PreviewProvider` (relative to workspace or absolute)."
        },
        previewDefinitionIndexInFile: {
          type: "integer",
          description: "0-based index of the `#Preview` declaration in the file when multiple previews exist. Default 0."
        },
        projectPath: {
          type: "string",
          description: "Optional `.xcodeproj` / `.xcworkspace` path when multiple Xcode windows are open."
        },
        tabIdentifier: {
          type: "string",
          description: "Optional explicit Xcode `tabIdentifier`; auto-resolved when omitted."
        },
        workspaceDir: workspaceDirProperty
      },
      required: ["sourceFilePath"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
  },
  {
    name: "xcode_search_docs",
    title: "Search Apple Documentation",
    description: "Semantic search over Apple's official Developer Documentation and WWDC session transcripts built into the local Xcode installation (`DocumentationSearch`). Use this to verify modern SwiftUI / iOS / macOS APIs.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: 'Natural-language or symbol search query (e.g. "NavigationSplitView columnVisibility SwiftUI").'
        },
        frameworks: {
          type: "string",
          description: 'Optional comma-separated framework filter (e.g. "SwiftUI,Observation").'
        }
      },
      required: ["query"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "xcode_sync_skills",
    title: "Sync Apple Xcode Skills",
    description: "Export Apple's built-in `SKILL.md` agent skill bundles from the active Xcode installation via `xcrun agent skills export` and cache them locally.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceDir: workspaceDirProperty
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
  },
  {
    name: "xcode_call_tool",
    title: "Call Raw Xcode MCP Tool",
    description: "List or invoke any raw MCP tool exposed by `xcrun mcpbridge` (such as `ExecuteSnippet`, `XcodeRead`, `XcodeWrite`, `XcodeUpdate`, `XcodeGlob`, `XcodeGrep`, or Xcode 27+ `DeviceInteraction*` tools).",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "call"],
          description: '"list" returns all raw tools & input schemas from `mcpbridge`; "call" executes `toolName`.'
        },
        toolName: {
          type: "string",
          description: 'Raw Xcode MCP tool name when `action` is "call" (e.g. "ExecuteSnippet", "XcodeListWindows").'
        },
        argumentsJson: {
          type: "string",
          description: 'JSON object string of arguments passed to `toolName` when `action` is "call".'
        },
        workspaceDir: workspaceDirProperty
      },
      required: ["action"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
  }
];
function isPluginCacheDir(dir) {
  const normalized = dir.replace(/\\/gu, "/");
  return normalized.includes("/.codex/plugins/") || normalized.includes("/.claude/plugins/") || normalized.endsWith("/plugins/xcode") || normalized.includes("/plugins/xcode/");
}
function resolveEffectiveWorkspaceDir(options) {
  const fallback = options.fallbackCwd ?? process.cwd();
  if (typeof options.workspaceDir === "string" && options.workspaceDir.trim() !== "") {
    return resolve3(fallback, options.workspaceDir.trim());
  }
  if (typeof options.candidatePath === "string" && options.candidatePath.trim() !== "" && isAbsolute(options.candidatePath.trim())) {
    const abs = options.candidatePath.trim();
    if (isPluginCacheDir(fallback)) {
      return dirname3(abs);
    }
  }
  if (isPluginCacheDir(fallback) && Array.isArray(options.openWindows) && options.openWindows.length > 0) {
    const activeWin = options.openWindows.find((w) => w.active && w.workspacePath) ?? options.openWindows.find((w) => w.workspacePath);
    if (activeWin?.workspacePath) {
      return dirname3(activeWin.workspacePath);
    }
  }
  return fallback;
}
function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function formatToolResult(value, extraContent = []) {
  const structured = typeof value === "object" && value !== null && !Array.isArray(value) ? value : { result: value };
  return {
    content: [
      { type: "text", text: JSON.stringify(value, null, 2) },
      ...extraContent
    ],
    structuredContent: structured
  };
}
var XcodeMcpServer = class {
  controller;
  skillsCacheRoot;
  defaultCwd;
  exportedSkills = [];
  hydratedSkills = false;
  constructor(options = {}) {
    this.controller = new XcodeBridgeController(options);
    this.skillsCacheRoot = options.skillsCacheDir ?? defaultSkillsCacheRoot();
    this.defaultCwd = options.defaultCwd ?? process.cwd();
  }
  async maybeHydrateSkills(xcodeBuild, xcodePid) {
    const tag = (xcodeBuild ?? "default").replace(/[^A-Za-z0-9._-]+/gu, "_");
    if (!this.hydratedSkills) {
      this.hydratedSkills = true;
      const cached = await loadCachedAppleSkills(`${this.skillsCacheRoot}/${tag}`);
      if (cached.length > 0) {
        this.exportedSkills = cached.map((s) => s.registeredName);
        this.controller.setExportedSkillNames(this.exportedSkills);
        return this.exportedSkills;
      }
    }
    if (xcodePid !== void 0) {
      try {
        const exported = await exportAppleSkillsFromXcode({
          cacheRoot: this.skillsCacheRoot,
          xcodeBuild,
          xcodePid
        });
        this.exportedSkills = exported.skills.map((s) => s.registeredName);
        this.controller.setExportedSkillNames(this.exportedSkills);
      } catch {
      }
    }
    return this.exportedSkills;
  }
  async executeTool(name, args = {}) {
    const statusSnapshot = await this.controller.status({ connectIfRunning: false }).catch(() => void 0);
    const cwd = resolveEffectiveWorkspaceDir({
      workspaceDir: args.workspaceDir,
      candidatePath: args.projectPath ?? args.filePath ?? args.sourceFilePath,
      openWindows: statusSnapshot?.openWindows,
      fallbackCwd: this.defaultCwd
    });
    switch (name) {
      case "xcode_status": {
        const stat2 = await this.controller.status({
          connectIfRunning: args.connect !== false,
          cwd
        });
        const skills = await this.maybeHydrateSkills(stat2.xcodeVersion?.build, stat2.xcodePid);
        return formatToolResult({
          cwd,
          ...stat2,
          exportedSkills: skills
        });
      }
      case "xcode_open_project": {
        const res = await this.controller.openProject({
          projectPath: typeof args.projectPath === "string" ? args.projectPath : void 0,
          cwd,
          waitSeconds: typeof args.waitSeconds === "number" ? args.waitSeconds : void 0
        });
        if (res.connected) {
          const st = await this.controller.status({ connectIfRunning: false });
          await this.maybeHydrateSkills(st.xcodeVersion?.build, res.xcodePid);
        }
        return formatToolResult({ cwd, ...res });
      }
      case "xcode_diagnostics": {
        const res = await this.controller.diagnostics({
          filePath: typeof args.filePath === "string" ? args.filePath : void 0,
          projectPath: typeof args.projectPath === "string" ? args.projectPath : void 0,
          tabIdentifier: typeof args.tabIdentifier === "string" ? args.tabIdentifier : void 0,
          severity: typeof args.severity === "string" ? args.severity : void 0,
          pattern: typeof args.pattern === "string" ? args.pattern : void 0,
          cwd
        });
        return formatToolResult({ cwd, ...res });
      }
      case "xcode_build_test": {
        const action = String(args.action ?? "");
        let parsedTests;
        if (typeof args.tests === "string" && args.tests.trim() !== "") {
          let parsed;
          try {
            parsed = JSON.parse(args.tests);
          } catch {
            throw new Error("`tests` must be a JSON array of test specifiers from `list_tests`.");
          }
          if (!Array.isArray(parsed)) {
            throw new Error("`tests` must be a JSON array of test specifiers from `list_tests`.");
          }
          parsedTests = parsed;
        } else if (Array.isArray(args.tests)) {
          parsedTests = args.tests;
        }
        const res = await this.controller.buildOrTest({
          action,
          tests: parsedTests,
          projectPath: typeof args.projectPath === "string" ? args.projectPath : void 0,
          tabIdentifier: typeof args.tabIdentifier === "string" ? args.tabIdentifier : void 0,
          severity: typeof args.severity === "string" ? args.severity : void 0,
          pattern: typeof args.pattern === "string" ? args.pattern : void 0,
          cwd
        });
        return formatToolResult({ cwd, ...res });
      }
      case "xcode_render_preview": {
        const rendered = await this.controller.renderPreview({
          sourceFilePath: String(args.sourceFilePath ?? ""),
          ...typeof args.previewDefinitionIndexInFile === "number" ? { previewDefinitionIndexInFile: Math.trunc(args.previewDefinitionIndexInFile) } : {},
          projectPath: typeof args.projectPath === "string" ? args.projectPath : void 0,
          tabIdentifier: typeof args.tabIdentifier === "string" ? args.tabIdentifier : void 0,
          cwd
        });
        const summary = {
          cwd,
          tabIdentifier: rendered.tabIdentifier,
          sourceFilePath: rendered.sourceFilePath,
          previews: rendered.savedPreviews.map((p) => ({
            file: p.relativeImagePath,
            absolutePath: p.absoluteImagePath,
            mimeType: p.mimeType,
            bytes: p.bytes
          })),
          ...rendered.text ? { text: rendered.text } : {},
          ...rendered.structured !== void 0 ? { structured: rendered.structured } : {}
        };
        const imageBlocks = rendered.images.map((img) => ({
          type: "image",
          data: img.bytes.toString("base64"),
          mimeType: img.mimeType
        }));
        return formatToolResult(summary, imageBlocks);
      }
      case "xcode_search_docs": {
        const frameworks = typeof args.frameworks === "string" && args.frameworks.trim() !== "" ? args.frameworks.split(",").map((s) => s.trim()).filter(Boolean) : Array.isArray(args.frameworks) ? args.frameworks.map(String) : void 0;
        const res = await this.controller.searchDocs({
          query: String(args.query ?? ""),
          frameworks
        });
        return formatToolResult(res);
      }
      case "xcode_sync_skills": {
        const stat2 = await this.controller.status({ connectIfRunning: true });
        const exported = await exportAppleSkillsFromXcode({
          cacheRoot: this.skillsCacheRoot,
          xcodeBuild: stat2.xcodeVersion?.build,
          xcodePid: stat2.xcodePid
        });
        this.exportedSkills = exported.skills.map((s) => s.registeredName);
        this.controller.setExportedSkillNames(this.exportedSkills);
        await this.controller.persistWorkbenchState(cwd).catch(() => {
        });
        return formatToolResult({
          cwd,
          outputDir: exported.outputDir,
          count: exported.skills.length,
          skills: exported.skills.map((s) => ({
            name: s.registeredName,
            title: s.title,
            description: s.description,
            skillFilePath: s.skillFilePath
          }))
        });
      }
      case "xcode_call_tool": {
        const action = args.action === "list" ? "list" : "call";
        let parsedArgs = {};
        if (typeof args.argumentsJson === "string" && args.argumentsJson.trim() !== "") {
          let parsed;
          try {
            parsed = JSON.parse(args.argumentsJson);
          } catch {
            throw new Error("`argumentsJson` must be a valid JSON object string.");
          }
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("`argumentsJson` must decode to a JSON object.");
          }
          parsedArgs = parsed;
        } else if (args.arguments && typeof args.arguments === "object" && !Array.isArray(args.arguments)) {
          parsedArgs = args.arguments;
        }
        if (action === "call" && parsedArgs.tabIdentifier === void 0 && args.toolName !== "XcodeListWindows" && args.toolName !== "DocumentationSearch") {
          try {
            parsedArgs.tabIdentifier = await this.controller.resolveTabIdentifier({ projectPath: cwd });
          } catch {
          }
        }
        const res = await this.controller.listOrCallRawTool({
          action,
          toolName: typeof args.toolName === "string" ? args.toolName : void 0,
          arguments: parsedArgs,
          cwd
        });
        if (action === "list") {
          return formatToolResult(res);
        }
        const callRes = res;
        return formatToolResult({
          toolName: args.toolName,
          isError: Boolean(callRes.isError),
          ...callRes.structuredContent !== void 0 ? { structured: callRes.structuredContent } : {},
          text: callRes.text
        });
      }
      default: {
        const rawArgs = { ...args };
        delete rawArgs.workspaceDir;
        if (rawArgs.tabIdentifier === void 0 && name !== "XcodeListWindows" && name !== "DocumentationSearch") {
          try {
            rawArgs.tabIdentifier = await this.controller.resolveTabIdentifier({ projectPath: cwd });
          } catch {
          }
        }
        const res = await this.controller.listOrCallRawTool({
          action: "call",
          toolName: name,
          arguments: rawArgs,
          cwd
        });
        const callRes = res;
        return formatToolResult({
          toolName: name,
          isError: Boolean(callRes.isError),
          ...callRes.structuredContent !== void 0 ? { structured: callRes.structuredContent } : {},
          text: callRes.text
        });
      }
    }
  }
  async dispatch(message) {
    if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return jsonRpcError(null, -32600, "Expected a JSON-RPC 2.0 request or notification.");
    }
    const msg = message;
    const hasId = Object.prototype.hasOwnProperty.call(msg, "id");
    if (hasId && msg.id !== null && typeof msg.id !== "string" && typeof msg.id !== "number") {
      return jsonRpcError(null, -32600, "Invalid JSON-RPC request id.");
    }
    const id = msg.id ?? null;
    const reply = (result) => ({ jsonrpc: "2.0", id, result });
    try {
      if (!hasId) {
        return null;
      }
      switch (msg.method) {
        case "initialize": {
          const requestedProtocol = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "2025-06-18";
          return reply({
            protocolVersion: requestedProtocol,
            capabilities: {
              tools: { listChanged: true }
            },
            serverInfo: {
              name: MCP_SERVER_NAME,
              version: MCP_SERVER_VERSION
            },
            instructions: "Apple Xcode MCP bridge (`xcrun mcpbridge`) with single-file live compiler diagnostics, native SwiftUI `#Preview` rendering, warm incremental scheme builds and tests, local Apple Developer Documentation search, automatic `tabIdentifier` routing, and Xcode 26 `structuredContent` normalization."
          });
        }
        case "ping":
          return reply({});
        case "tools/list":
          return reply({ tools: MCP_XCODE_TOOLS });
        case "resources/list":
          return reply({ resources: [] });
        case "prompts/list":
          return reply({ prompts: [] });
        case "tools/call": {
          const toolName = typeof msg.params?.name === "string" ? msg.params.name.trim() : "";
          if (!toolName) {
            return jsonRpcError(id, -32602, "Missing `params.name` in `tools/call`.");
          }
          const rawArgs = msg.params?.arguments;
          const toolArgs = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};
          const out = await this.executeTool(toolName, toolArgs);
          return reply(out);
        }
        default:
          return jsonRpcError(id, -32601, `Method not found: ${msg.method}`);
      }
    } catch (err) {
      if (!hasId) return null;
      const messageText = err instanceof Error ? err.message : String(err);
      const code = err?.code;
      if (msg.method === "tools/call") {
        return reply({
          content: [{ type: "text", text: messageText }],
          isError: true,
          ...code ? { structuredContent: { error: messageText, code } } : {}
        });
      }
      return jsonRpcError(id, -32e3, messageText);
    }
  }
  async close() {
    await this.controller.dispose();
  }
};
async function writeLine(payload) {
  if (!payload) return;
  if (!process.stdout.write(`${JSON.stringify(payload)}
`)) {
    await once(process.stdout, "drain");
  }
}
async function runStdioMcpServer(options = {}) {
  const server = new XcodeMcpServer(options);
  const shutdown = () => {
    process.stdin.destroy();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  let queue = Promise.resolve();
  try {
    for await (const chunk of process.stdin) {
      buffer += decoder.write(chunk);
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (Buffer.byteLength(line) > MAX_MESSAGE_BYTES) {
          throw new Error("MCP stdio input line exceeds the 32 MiB size limit.");
        }
        if (!line.trim()) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          await writeLine(jsonRpcError(null, -32700, "Invalid JSON on MCP stdio stream."));
          continue;
        }
        queue = queue.then(async () => {
          const response = await server.dispatch(parsed);
          await writeLine(response);
        });
        await queue;
      }
      if (Buffer.byteLength(buffer) > MAX_MESSAGE_BYTES) {
        throw new Error("MCP stdio input buffer exceeds the 32 MiB size limit.");
      }
    }
    buffer += decoder.end();
    if (buffer.trim()) {
      await writeLine(jsonRpcError(null, -32700, "MCP stdio messages must end with a newline."));
    }
  } finally {
    process.off("SIGTERM", shutdown);
    process.off("SIGINT", shutdown);
    await server.close();
  }
}
var isMain = Boolean(
  process.argv[1] && resolve3(process.argv[1]) === fileURLToPath(import.meta.url)
);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--doctor")) {
    const server = new XcodeMcpServer();
    server.executeTool("xcode_status", { connect: true }).then((res) => {
      process.stdout.write(`${JSON.stringify({ ok: true, status: res.structuredContent }, null, 2)}
`);
      return server.close();
    }).catch((err) => {
      process.stderr.write(`dsh-xcode doctor failed: ${err instanceof Error ? err.message : String(err)}
`);
      process.exitCode = 1;
      return server.close();
    });
  } else {
    runStdioMcpServer().catch((err) => {
      process.stderr.write(`dsh-xcode mcp-server error: ${err instanceof Error ? err.message : String(err)}
`);
      process.exitCode = 1;
    });
  }
}
export {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_XCODE_TOOLS,
  XcodeMcpServer,
  jsonRpcError,
  resolveEffectiveWorkspaceDir,
  runStdioMcpServer
};
