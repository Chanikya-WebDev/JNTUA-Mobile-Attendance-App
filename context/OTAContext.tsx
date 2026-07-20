import React, { createContext, ReactNode, useState } from 'react';
import { DEFAULT_OTA_CONFIG } from '../lib/otaDefaults';
import { OTAConfig } from '../lib/otaTypes';

interface OTAContextValue {
  config: OTAConfig;
  script: string;
  loading: boolean;
  version: number;
  refresh: () => Promise<void>;
}

const OTAContext = createContext<OTAContextValue>({} as OTAContextValue);

export function OTAProvider({ children, bundledScript }: { children: ReactNode; bundledScript: string }) {
  const [config] = useState<OTAConfig>(DEFAULT_OTA_CONFIG);
  const [script] = useState<string>(bundledScript);
  const [loading] = useState(false);
  const [version] = useState(0);

  const refresh = async () => {
    // Placeholder for refresh functionality
  };

  const value: OTAContextValue = {
    config,
    script,
    loading,
    version,
    refresh,
  };

  return <OTAContext.Provider value={value}>{children}</OTAContext.Provider>;
}

export { OTAContext };

