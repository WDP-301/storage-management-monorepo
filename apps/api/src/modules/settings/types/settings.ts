import type { SystemSetting } from '@entities/system-setting.entity';
import type { SettingValueType } from '@storage/types';

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

/** Maps a `system_settings` row to its API representation — the row carries all metadata. */
export function toSystemSettingRecord(row: SystemSetting): SystemSettingRecord {
  return {
    key: row.key,
    value: row.value,
    value_type: row.valueType,
    group: row.group,
    label: row.label ?? row.key,
    description: row.description ?? null,
    default: row.defaultValue ?? null,
    min: row.min ?? null,
    max: row.max ?? null,
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
