import { spawn } from "node:child_process";

export const PROCESS_SUPERVISOR_SCHEMA_VERSION = 1;

export class ProcessSupervisorValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProcessSupervisorValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new ProcessSupervisorValidationError(`${field} must be a non-empty string`);
}

function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new ProcessSupervisorValidationError(`${field} must be a positive integer`);
}

function boundedError(error) {
  return String(error?.message ?? error).slice(0, 256);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function healthRequest(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return response.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function createProcessSupervisor({
  command,
  args = [],
  cwd = process.cwd(),
  env = {},
  healthUrl,
  startupTimeoutMs = 3000,
  shutdownTimeoutMs = 1000,
  healthRequestTimeoutMs = 250,
  healthPollMs = 25,
  maxRestarts = 2,
} = {}) {
  assertNonEmpty(command, "command");
  assertNonEmpty(cwd, "cwd");
  assertNonEmpty(healthUrl, "healthUrl");
  try { new URL(healthUrl); } catch { throw new ProcessSupervisorValidationError("healthUrl must be a valid URL"); }
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) throw new ProcessSupervisorValidationError("args must contain only strings");
  if (!env || typeof env !== "object" || Array.isArray(env) || Object.entries(env).some(([key, value]) => typeof key !== "string" || typeof value !== "string")) throw new ProcessSupervisorValidationError("env must be a string map");
  for (const [field, value] of Object.entries({ startupTimeoutMs, shutdownTimeoutMs, healthRequestTimeoutMs, healthPollMs })) assertPositiveInteger(value, field);
  if (!Number.isInteger(maxRestarts) || maxRestarts < 0) throw new ProcessSupervisorValidationError("maxRestarts must be an integer >= 0");

  let child = null;
  let intentionalStop = false;
  let exitWaiter = null;
  const state = {
    schemaVersion: PROCESS_SUPERVISOR_SCHEMA_VERSION,
    lifecycle: "stopped",
    pid: null,
    startCount: 0,
    restartCount: 0,
    lastExitCode: null,
    lastExitSignal: null,
    lastError: null,
  };

  function settleExit() {
    if (!exitWaiter) return;
    const resolve = exitWaiter;
    exitWaiter = null;
    resolve();
  }

  function attachProcess(nextChild) {
    child = nextChild;
    state.pid = nextChild.pid ?? null;
    nextChild.once("error", (error) => {
      if (child !== nextChild) return;
      state.lastError = boundedError(error);
      state.lifecycle = "failed";
      state.pid = null;
      child = null;
      settleExit();
    });
    nextChild.once("exit", (code, signal) => {
      if (child !== nextChild) return;
      state.lastExitCode = code;
      state.lastExitSignal = signal;
      state.pid = null;
      child = null;
      state.lifecycle = intentionalStop ? "stopped" : "failed";
      settleExit();
    });
  }

  async function waitForHealthy() {
    const deadline = Date.now() + startupTimeoutMs;
    while (Date.now() < deadline) {
      if (!child) throw new ProcessSupervisorValidationError("supervised process exited before becoming healthy");
      if (await healthRequest(healthUrl, healthRequestTimeoutMs)) {
        state.lifecycle = "ready";
        return;
      }
      await delay(healthPollMs);
    }
    throw new ProcessSupervisorValidationError("supervised process did not become healthy before startup timeout");
  }

  async function start() {
    if (state.lifecycle === "ready" || state.lifecycle === "starting") return projection();
    intentionalStop = false;
    state.lifecycle = "starting";
    state.lastError = null;
    state.startCount += 1;
    const nextChild = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
      shell: false,
    });
    attachProcess(nextChild);
    try {
      await waitForHealthy();
    } catch (error) {
      state.lastError = boundedError(error);
      await stop();
      state.lifecycle = "failed";
      throw error;
    }
    return projection();
  }

  async function stop() {
    if (!child) {
      state.lifecycle = "stopped";
      state.pid = null;
      return projection();
    }
    intentionalStop = true;
    state.lifecycle = "stopping";
    const nextChild = child;
    try { nextChild.kill("SIGTERM"); } catch (error) { state.lastError = boundedError(error); }
    const deadline = Date.now() + shutdownTimeoutMs;
    while (child === nextChild && Date.now() < deadline) await delay(10);
    if (child === nextChild) {
      try { nextChild.kill("SIGKILL"); } catch (error) { state.lastError = boundedError(error); }
      exitWaiter = new Promise((resolve) => { setTimeout(resolve, shutdownTimeoutMs); });
      await exitWaiter;
    }
    state.lifecycle = "stopped";
    state.pid = null;
    child = null;
    return projection();
  }

  async function restart() {
    if (state.restartCount >= maxRestarts) throw new ProcessSupervisorValidationError("supervisor restart budget exhausted");
    await stop();
    state.restartCount += 1;
    return start();
  }

  function projection() {
    return clone({
      ...state,
      omittedFields: ["command", "args", "environment", "healthUrl"],
    });
  }

  return {
    get lifecycle() { return state.lifecycle; },
    get pid() { return state.pid; },
    get projection() { return projection(); },
    start,
    stop,
    restart,
  };
}
