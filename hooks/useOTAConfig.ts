import { useContext } from 'react';
import { OTAContext } from '../context/OTAContext';

export function useOTAConfig() {
  const context = useContext(OTAContext);
  if (!context) {
    throw new Error('useOTAConfig must be used within OTAProvider');
  }
  return context;
}
