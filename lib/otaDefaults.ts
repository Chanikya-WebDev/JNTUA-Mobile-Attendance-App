import { OTAConfig } from './otaTypes';

export const DEFAULT_OTA_CONFIG: OTAConfig = {
  colors: {
    safe: '#22C55E',
    caution: '#EAB308',
    warning: '#F59E0B',
    danger: '#EF4444',
    accent: '#7C3AED',
    info: '#6366F1',
  },
  labels: {
    safe: 'Safe',
    caution: 'Caution',
    risk: 'At Risk',
    low: 'Low',
  },
  thresholds: {
    safe: 77,
    minimum: 75,
    warning: 70,
  },
  accentColor: '#7C3AED',
  portalUrl: 'https://jntuaceastudents.classattendance.in/',
  showQuickTip: true,
  quickTipText: 'Maintain 75% attendance to stay eligible for exams.',
};
