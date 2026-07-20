import AsyncStorage from '@react-native-async-storage/async-storage';
import { OTAUpdate, OTAConfig } from './otaTypes';

const OTA_CACHE_KEY = 'ota_cache';
const OTA_LAST_FETCH_KEY = 'ota_last_fetch';
const FETCH_INTERVAL_MS = 14400000; // 4 hours

export class OTAService {
  async fetchLatestUpdate(): Promise<OTAUpdate | null> {
    // Placeholder for fetching from server
    return null;
  }

  async saveToCache(update: OTAUpdate): Promise<void> {
    const cache = {
      version: update.version,
      scraperScript: update.scraperScript,
      config: update.config,
      styleScript: update.styleScript,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(OTA_CACHE_KEY, JSON.stringify(cache));
  }

  async readCache(): Promise<any> {
    const cached = await AsyncStorage.getItem(OTA_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  }

  async shouldFetch(): Promise<boolean> {
    const lastFetch = await AsyncStorage.getItem(OTA_LAST_FETCH_KEY);
    if (!lastFetch) return true;
    const elapsed = Date.now() - parseInt(lastFetch);
    return elapsed >= FETCH_INTERVAL_MS;
  }

  async getActiveScript(bundledScript: string): Promise<string> {
    if (await this.shouldFetch()) {
      const update = await this.fetchLatestUpdate();
      if (update) {
        await this.saveToCache(update);
        await AsyncStorage.setItem(OTA_LAST_FETCH_KEY, Date.now().toString());
        return update.scraperScript;
      }
    }
    const cache = await this.readCache();
    return cache?.scraperScript || bundledScript;
  }

  async getActiveConfig(): Promise<OTAConfig> {
    const cache = await this.readCache();
    return cache?.config || null;
  }

  async forceRefresh(): Promise<void> {
    // Placeholder for force refresh
  }

  async clearCache(): Promise<void> {
    await AsyncStorage.removeItem(OTA_CACHE_KEY);
    await AsyncStorage.removeItem(OTA_LAST_FETCH_KEY);
  }
}

export const otaService = new OTAService();
