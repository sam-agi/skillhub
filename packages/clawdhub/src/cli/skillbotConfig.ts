import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import JSON5 from "json5";
import { resolveHome } from "../homedir.js";

type SkillbotConfig = {
  agent?: { workspace?: string };
  agents?: {
    defaults?: { workspace?: string };
    list?: Array<{
      id?: string;
      name?: string;
      workspace?: string;
      default?: boolean;
    }>;
  };
  routing?: {
    agents?: Record<
      string,
      {
        name?: string;
        workspace?: string;
      }
    >;
  };
  skills?: {
    load?: {
      extraDirs?: string[];
    };
  };
};

export type SkillbotSkillRoots = {
  roots: string[];
  labels: Record<string, string>;
};

export async function resolveSkillbotSkillRoots(): Promise<SkillbotSkillRoots> {
  const roots: string[] = [];
  const labels: Record<string, string> = {};

  const skillbotStateDir = resolveSkillbotStateDir();
  const sharedSkills = resolveUserPath(join(skillbotStateDir, "skills"));
  pushRoot(roots, labels, sharedSkills, "Shared skills");

  const openskillStateDir = resolveOpenskillStateDir();
  const openskillShared = resolveUserPath(join(openskillStateDir, "skills"));
  pushRoot(roots, labels, openskillShared, "OpenSkill: Shared skills");

  const [skillbotConfig, openskillConfig] = await Promise.all([
    readSkillbotConfig(),
    readOpenskillConfig(),
  ]);
  if (!skillbotConfig && !openskillConfig) return { roots, labels };

  if (skillbotConfig) {
    addConfigRoots(skillbotConfig, roots, labels);
  }
  if (openskillConfig) {
    addConfigRoots(openskillConfig, roots, labels, "OpenSkill");
  }

  return { roots, labels };
}

export async function resolveSkillbotDefaultWorkspace(): Promise<string | null> {
  const config = await readSkillbotConfig();
  const openskillConfig = await readOpenskillConfig();
  if (!config && !openskillConfig) return null;

  const defaultsWorkspace = resolveUserPath(
    config?.agents?.defaults?.workspace ?? config?.agent?.workspace ?? "",
  );
  if (defaultsWorkspace) return defaultsWorkspace;

  const listedAgents = config?.agents?.list ?? [];
  const defaultAgent =
    listedAgents.find((entry) => entry.default) ??
    listedAgents.find((entry) => entry.id === "main");
  const listWorkspace = resolveUserPath(defaultAgent?.workspace ?? "");
  if (listWorkspace) return listWorkspace;

  if (!openskillConfig) return null;
  const openskillDefaults = resolveUserPath(
    openskillConfig.agents?.defaults?.workspace ?? openskillConfig.agent?.workspace ?? "",
  );
  if (openskillDefaults) return openskillDefaults;
  const openskillAgents = openskillConfig.agents?.list ?? [];
  const openskillDefaultAgent =
    openskillAgents.find((entry) => entry.default) ??
    openskillAgents.find((entry) => entry.id === "main");
  const openskillWorkspace = resolveUserPath(openskillDefaultAgent?.workspace ?? "");
  return openskillWorkspace || null;
}

function resolveSkillbotStateDir() {
  const override = process.env.SKILLBOT_STATE_DIR?.trim();
  if (override) return resolveUserPath(override);
  return join(resolveHome(), ".skillbot");
}

function resolveSkillbotConfigPath() {
  const override = process.env.SKILLBOT_CONFIG_PATH?.trim();
  if (override) return resolveUserPath(override);
  return join(resolveSkillbotStateDir(), "skillbot.json");
}

function resolveOpenskillStateDir() {
  const override = process.env.OPENSKILL_STATE_DIR?.trim();
  if (override) return resolveUserPath(override);
  return join(resolveHome(), ".openskill");
}

function resolveOpenskillConfigPath() {
  const override = process.env.OPENSKILL_CONFIG_PATH?.trim();
  if (override) return resolveUserPath(override);
  return join(resolveOpenskillStateDir(), "openskill.json");
}

function resolveUserPath(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("~")) {
    return resolve(trimmed.replace(/^~(?=$|[\/])/, resolveHome()));
  }
  return resolve(trimmed);
}

async function readSkillbotConfig(): Promise<SkillbotConfig | null> {
  return readConfigFile(resolveSkillbotConfigPath());
}

async function readOpenskillConfig(): Promise<SkillbotConfig | null> {
  return readConfigFile(resolveOpenskillConfigPath());
}

async function readConfigFile(path: string): Promise<SkillbotConfig | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON5.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as SkillbotConfig;
  } catch {
    return null;
  }
}

function addConfigRoots(
  config: SkillbotConfig,
  roots: string[],
  labels: Record<string, string>,
  labelPrefix?: string,
) {
  const prefix = labelPrefix ? `${labelPrefix}: ` : "";

  const mainWorkspace = resolveUserPath(
    config.agents?.defaults?.workspace ?? config.agent?.workspace ?? "",
  );
  if (mainWorkspace) {
    pushRoot(roots, labels, join(mainWorkspace, "skills"), `${prefix}Agent: main`);
  }

  const listedAgents = config.agents?.list ?? [];
  for (const entry of listedAgents) {
    const workspace = resolveUserPath(entry?.workspace ?? "");
    if (!workspace) continue;
    const name = entry?.name?.trim() || entry?.id?.trim() || "agent";
    pushRoot(roots, labels, join(workspace, "skills"), `${prefix}Agent: ${name}`);
  }

  const agents = config.routing?.agents ?? {};
  for (const [agentId, entry] of Object.entries(agents)) {
    const workspace = resolveUserPath(entry?.workspace ?? "");
    if (!workspace) continue;
    const name = entry?.name?.trim() || agentId;
    pushRoot(roots, labels, join(workspace, "skills"), `${prefix}Agent: ${name}`);
  }

  const extraDirs = config.skills?.load?.extraDirs ?? [];
  for (const dir of extraDirs) {
    const resolved = resolveUserPath(String(dir));
    if (!resolved) continue;
    const label = `${prefix}Extra: ${basename(resolved) || resolved}`;
    pushRoot(roots, labels, resolved, label);
  }
}

function pushRoot(roots: string[], labels: Record<string, string>, root: string, label?: string) {
  const resolved = resolveUserPath(root);
  if (!resolved) return;
  if (!roots.includes(resolved)) roots.push(resolved);
  if (!label) return;
  const existing = labels[resolved];
  if (!existing) {
    labels[resolved] = label;
    return;
  }
  const parts = existing
    .split(", ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.includes(label)) return;
  labels[resolved] = `${existing}, ${label}`;
}
