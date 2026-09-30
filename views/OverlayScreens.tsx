import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CrabScene } from "../components/CrabScene";
import { COLORS, SERIF } from "../constants/theme";
interface OverlayScreensProps {
  gatewayError: boolean;
  isOffline: boolean;
  isStructureError: boolean;
  structureErrorMessage: string | null;
  isLoggedIn: boolean;
  isScrapingFinished: boolean;
  isSelectionError: boolean;
  totalSubjects: number | null;
  fetchedIndicesCount: number;
  syncPct: number;
  onFullReset: () => void;
  onClearSelectionError: () => void;
}

export function OverlayScreens({
  gatewayError,
  isOffline,
  isStructureError,
  structureErrorMessage,
  isLoggedIn,
  isScrapingFinished,
  isSelectionError,
  totalSubjects,
  fetchedIndicesCount,
  syncPct,
  onFullReset,
  onClearSelectionError,
}: OverlayScreensProps) {
  // Explicit priority: offline > gateway > structure > selection > syncing.
  if (isOffline) {
    return (
      <View style={styles.overlayFull}>
        <CrabScene />
        <Text style={styles.syncTitle}>{"No Internet\nConnection"}</Text>
        <Text style={styles.syncSub}>Please check your network settings and try again.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onFullReset}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (gatewayError) {
    return (
      <View style={styles.overlayFull}>
        <CrabScene />
        <Text style={styles.syncTitle}>{"Main attendance\nwebsite is not working"}</Text>
        <Text style={styles.syncSub}>The portal is temporarily unavailable (502).</Text>
        <TouchableOpacity style={styles.errorBtn} onPress={onFullReset}>
          <Text style={styles.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isStructureError) {
    return (
      <View style={styles.overlayFull}>
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorTitle}>Portal Layout Changed</Text>
          <Text style={styles.errorBody}>
            {structureErrorMessage ??
              "The original attendance website modified its internal structure. An update to this app is required to parse your subjects correctly."}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onFullReset}>
            <Text style={styles.btnText}>Reload Portal</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Selection error is dismissible; surface it above the syncing loader.
  if (isSelectionError && isLoggedIn && !isScrapingFinished) {
    return (
      <View style={styles.overlayFull}>
        <View style={styles.errorCard}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClearSelectionError} accessibilityRole="button" accessibilityLabel="Dismiss loading error">
            <Text style={styles.closeIconText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorTitle}>Couldn’t load subjects right now</Text>
          <Text style={styles.errorBody}>
            The attendance portal was recently updated, so the app can’t detect your semester or
            subjects at the moment. This is a temporary issue — we’re working on a fix.
          </Text>
          <TouchableOpacity style={styles.errorBtn} onPress={onFullReset} accessibilityRole="button" accessibilityLabel="Retry loading subjects">
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoggedIn && !isScrapingFinished) {
    return (
      <View style={styles.overlayFull}>
        <CrabScene />
        <Text style={styles.syncEyebrow}>SYNCING</Text>
        <Text style={styles.syncTitle}>{"Reading your\nsemester"}</Text>
        <Text style={styles.syncSub}>
          {totalSubjects ? `Processed ${fetchedIndicesCount} of ${totalSubjects} subjects` : "Authenticating session…"}
        </Text>
        <Text style={styles.syncPct}>
          {syncPct}
          <Text style={styles.syncPctSign}>%</Text>
        </Text>
        <Text style={styles.syncFine}>Secure session · jntuaceastudents.classattendance.in</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onFullReset} accessibilityRole="button" accessibilityLabel="Cancel sync">
          <Text style={styles.btnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: COLORS.canvas,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  syncEyebrow: { fontSize: 11, fontWeight: "500", letterSpacing: 1.6, color: COLORS.primary, marginTop: 20 },
  syncTitle: { fontFamily: SERIF, fontSize: 26, letterSpacing: -0.5, color: COLORS.ink, lineHeight: 31, marginTop: 10, textAlign: "center" },
  syncSub: { fontSize: 12.5, color: COLORS.muted, marginTop: 8, textAlign: "center" },
  syncPct: { fontFamily: SERIF, fontSize: 54, letterSpacing: -2, color: COLORS.primary, lineHeight: 60, marginTop: 16 },
  syncPctSign: { fontSize: 24, color: COLORS.mutedSoft },
  syncFine: { fontSize: 10.5, color: COLORS.mutedSoft, marginTop: 14, letterSpacing: 0.3 },
  errorCard: { width: "100%", backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 12, padding: 24, alignItems: "center" },
  errorIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.error, color: COLORS.onDark, fontSize: 20, fontWeight: "700", textAlign: "center", lineHeight: 34, overflow: "hidden" },
  errorTitle: { fontFamily: SERIF, fontSize: 19, letterSpacing: -0.3, color: COLORS.ink, marginTop: 12, textAlign: "center" },
  errorBody: { fontSize: 13, lineHeight: 19, color: COLORS.muted, marginTop: 8, textAlign: "center" },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, alignSelf: "stretch", alignItems: "center", marginTop: 16 },
  errorBtn: { backgroundColor: COLORS.error, borderRadius: 8, paddingVertical: 12, alignSelf: "stretch", alignItems: "center", marginTop: 16 },
  btnText: { color: COLORS.onDark, fontWeight: "600", fontSize: 14 },
  closeIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.hairline, backgroundColor: COLORS.canvas, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  closeIconText: { fontSize: 13, color: COLORS.body, fontWeight: "600" },
});