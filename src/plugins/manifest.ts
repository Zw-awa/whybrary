import type { PluginPermission } from './types';

export const PLUGIN_MANIFEST_FILE = 'whybrary-plugin.json';
export const PLUGIN_MANIFEST_VERSION = 1;

const supportedPermissions = [
  'workspace:read',
  'ui:panel',
  'commands:register',
  'settings:read',
  'settings:write',
] as const satisfies readonly PluginPermission[];

export type PluginManifest = {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  engine: string;
  entry: string;
  permissions: PluginPermission[];
};

export type ManifestValidation =
  { ok: true; manifest: PluginManifest } | { ok: false; code: string; message: string };

function fail(code: string, message: string): ManifestValidation {
  return { ok: false, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validId(value: string): boolean {
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
}

function validEntry(value: string): boolean {
  return !value.startsWith('/') && !value.startsWith('\\') && !value.split(/[\\/]/).includes('..');
}

export function validatePluginManifest(value: unknown): ManifestValidation {
  if (!isRecord(value)) return fail('manifest.invalid', 'Plugin manifest must be a JSON object.');
  const schemaVersion = value.schemaVersion;
  const id = value.id;
  const name = value.name;
  const version = value.version;
  const engine = value.engine;
  const entry = value.entry;
  if (typeof schemaVersion !== 'number' || schemaVersion !== PLUGIN_MANIFEST_VERSION) {
    return fail(
      'manifest.schema-version',
      `Plugin manifest schemaVersion must be ${PLUGIN_MANIFEST_VERSION}.`,
    );
  }
  if (typeof id !== 'string' || !validId(id)) {
    return fail(
      'manifest.id',
      'Plugin manifest id must use lowercase letters, numbers, dots, dashes, or underscores.',
    );
  }
  if (!nonEmptyString(name))
    return fail('manifest.name', 'Plugin manifest name must be a non-empty string.');
  if (!nonEmptyString(version))
    return fail('manifest.version', 'Plugin manifest version must be a non-empty string.');
  if (!nonEmptyString(engine))
    return fail('manifest.engine', 'Plugin manifest engine must be a non-empty string.');
  if (!nonEmptyString(entry))
    return fail('manifest.entry', 'Plugin manifest entry must be a non-empty string.');
  if (!validEntry(entry))
    return fail('manifest.entry', 'Plugin entry must remain inside the plugin directory.');
  if (
    !Array.isArray(value.permissions) ||
    !value.permissions.every((permission) =>
      supportedPermissions.includes(permission as PluginPermission),
    )
  ) {
    return fail('manifest.permissions', 'Plugin manifest requests an unsupported permission.');
  }
  if (new Set(value.permissions).size !== value.permissions.length) {
    return fail('manifest.permissions', 'Plugin manifest permissions must not repeat values.');
  }
  return {
    ok: true,
    manifest: {
      schemaVersion,
      id,
      name,
      version,
      engine,
      entry,
      permissions: [...value.permissions] as PluginPermission[],
    },
  };
}
