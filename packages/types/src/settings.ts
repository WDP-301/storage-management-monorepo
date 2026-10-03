export type SettingValueType =
  | 'int'
  | 'float'
  | 'string'
  | 'boolean'
  | 'duration_minutes'
  | 'int_list';

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
  unit?: string | null;
  updated_by: string | null;
  updated_at: string | Date;
}

export interface SystemSettingsResponse {
  settings: SystemSettingRecord[];
}

export interface UpdateSettingsDto {
  values: Record<string, unknown>;
}

export interface UpdateSettingsResponse {
  settings: SystemSettingRecord[];
}
