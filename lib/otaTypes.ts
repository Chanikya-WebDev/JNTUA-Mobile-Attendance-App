export interface OTAColors {
  safe: string;
  caution: string;
  warning: string;
  danger: string;
  accent: string;
  info: string;
}

export interface OTALabels {
  safe: string;
  caution: string;
  risk: string;
  low: string;
}

export interface OTAThresholds {
  safe: number;
  minimum: number;
  warning: number;
}

export interface OTAConfig {
  colors: OTAColors;
  labels: OTALabels;
  thresholds: OTAThresholds;
  accentColor: string;
  portalUrl: string;
  showQuickTip: boolean;
  quickTipText?: string;
}

export interface OTAUpdate {
  version: number;
  scraperScript: string;
  styleScript?: string;
  config: OTAConfig;
  minAppVersion?: string;
  changelog?: string;
  scriptHash?: string;
}
