import type { SystemSetting } from '../entities/system-setting.entity';
import { SETTINGS_REGISTRY, type SettingValueType } from '../settings.registry';

export interface SystemSettingRecord {
  key: string;
  value: unknown;
  value_type: SettingValueType;
  group: string;
  label: string;
  description: string | null;
  default: unknown;
  min: number | null;
  max: number | null;
  updated_by: string | null;
  updated_at: string | Date;
}

/** Maps a `system_settings` row (merged with registry metadata) to its API representation. */
export function toSystemSettingRecord(row: SystemSetting): SystemSettingRecord {
  const def = SETTINGS_REGISTRY[row.key];

  return {
    key: row.key,
    value: row.value,
    value_type: row.valueType,
    group: row.group,
    label: def?.label ?? row.key,
    description: row.description ?? def?.description ?? null,
    default: def?.default ?? null,
    min: def?.min ?? null,
    max: def?.max ?? null,
    updated_by: row.updatedBy ?? null,
    updated_at: row.updatedAt,
  };
}

export interface SystemSettingsResponse {
  settings: SystemSettingRecord[];
}

export interface UpdateSettingsResponse {
  settings: SystemSettingRecord[];
}
