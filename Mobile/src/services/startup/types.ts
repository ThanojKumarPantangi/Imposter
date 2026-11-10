export interface ServerConfig {
  enabled: boolean;
  message: string;
}

export interface AppUpdateConfig {
  enabled: boolean;
  latestVersionCode: number;
  isUpdateRequired: boolean;
  isBlocked: boolean;
  updateUrl: string;
  title: string;
  message: string;
}

export interface AppConfigData {
  server: ServerConfig;
  appUpdate: AppUpdateConfig;
  version: number;
}

export interface AppConfigResponse {
  success: boolean;
  message?: string;
  data?: AppConfigData;
  error?: string;
}

export type StartupState = 'LOADING' | 'NORMAL_APP' | 'HARD_UPDATE' | 'MAINTENANCE';

export interface StartupEvaluation {
  state: StartupState;
  config: AppConfigData | null;
  reason?: string;
}

