import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function loadEnvFiles(envName, { cwd = process.cwd() } = {}) {
  const protectedKeys = new Set(Object.keys(process.env));
  const loadedEnv = {};

  for (const fileName of envFileNames(envName)) {
    const filePath = path.join(cwd, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    Object.assign(loadedEnv, parseEnvFile(readFileSync(filePath, 'utf8'), fileName));
  }

  for (const [key, value] of Object.entries(loadedEnv)) {
    if (!protectedKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

function envFileNames(envName) {
  return ['.env', '.env.local', `.env.${envName}`, `.env.${envName}.local`];
}

function parseEnvFile(contents, fileName) {
  const values = {};

  contents.split(/\r?\n/).forEach((line, index) => {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      return;
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(parsed.key)) {
      throw new Error(`${fileName}:${index + 1} has an invalid environment variable name: ${parsed.key}`);
    }

    values[parsed.key] = parsed.value;
  });

  return values;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return undefined;
  }

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trimStart() : trimmed;
  const separatorIndex = normalized.indexOf('=');
  if (separatorIndex === -1) {
    return undefined;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  const rawValue = normalized.slice(separatorIndex + 1).trim();
  return { key, value: parseEnvValue(rawValue) };
}

function parseEnvValue(rawValue) {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }

  return stripInlineComment(rawValue).trim();
}

function stripInlineComment(value) {
  const commentIndex = value.search(/\s#/);
  return commentIndex === -1 ? value : value.slice(0, commentIndex);
}
