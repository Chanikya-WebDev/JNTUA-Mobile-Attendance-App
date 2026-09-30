import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
export type UpdateStatus =
  | "checking"
  | "applying"
  | "ready"
  | "upToDate"
  | "error"
  | "unknown";

export interface UpdateManager {
  status: UpdateStatus;
  checkForUpdate: () => Promise<void>;
  lastError: string | null;
}

const CHECK_TIMEOUT_MS = 30_000;

/**
 * Deterministic guard to avoid redundant update checks on every hot reload /
 * re-mount during development. Returns `false` in `__DEV__` and in Expo Go
 * (where `expo-updates` is unavailable), `true` in production builds.
 */
export function shouldCheckOnMount(): boolean {
  return !__DEV__ && Constants.executionEnvironment === ExecutionEnvironment.Standalone;
}

/**
 * React hook that wraps the `expo-updates` API into the typed `UpdateStatus`
 * state machine. Returns `{ status, checkForUpdate, lastError }`.
 */
export function useUpdateManager(): UpdateManager {
  const {
    isChecking,
    isDownloading,
    isRestarting,
    isUpdatePending,
    isUpdateAvailable,
    checkError,
    downloadError,
  } = Updates.useUpdates();

  const [manualStatus, setManualStatus] = useState<UpdateStatus | null>(null);
  const [checkingTimedOut, setCheckingTimedOut] = useState(false);
  const checkingStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setCheckingTimedOut(false);
    checkingStartTimeRef.current = isChecking ? Date.now() : null;
  }, [isChecking]);

  useEffect(() => {
    if (!isChecking || !checkingStartTimeRef.current || checkingTimedOut)
      return;
    const remaining = Math.max(
      0,
      CHECK_TIMEOUT_MS - (Date.now() - (checkingStartTimeRef.current ?? 0))
    );
    const timeout = setTimeout(() => setCheckingTimedOut(true), remaining);
    return () => clearTimeout(timeout);
  }, [isChecking, checkingTimedOut]);

  let status: UpdateStatus;
  if (isChecking && !checkingTimedOut) status = "checking";
  else if (isDownloading || isRestarting) status = "applying";
  else if (checkError || downloadError) status = "error";
  else if (manualStatus !== null) status = manualStatus;
  else status = isUpdateAvailable || isUpdatePending ? "ready" : "unknown";

  const lastError: string | null =
    checkError?.message ?? downloadError?.message ?? null;

  const checkForUpdate = useCallback(async () => {
    if (!shouldCheckOnMount()) return;
    setManualStatus("checking");

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setManualStatus((prev) =>
        prev === "checking" ? "unknown" : prev
      );
    }, CHECK_TIMEOUT_MS);

    try {
      const result = await Updates.checkForUpdateAsync();
      if (timedOut) return;
      if (result.isAvailable) {
        setManualStatus("applying");
        await Updates.fetchUpdateAsync();
        if (timedOut) return;
        await Updates.reloadAsync();
      } else {
        setManualStatus("upToDate");
      }
    } catch {
      if (__DEV__) console.warn("Update check failed.");
      if (!timedOut) setManualStatus("error");
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  return { status, checkForUpdate, lastError };
}
