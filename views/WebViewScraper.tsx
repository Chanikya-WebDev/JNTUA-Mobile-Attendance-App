import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView, WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import { COLORS } from "../constants/theme";

const INJECT_HUMAN_NOTE_JS = `
  (function() {
    if (document.getElementById('human-verify-note')) return;
    var note = document.createElement('div');
    note.id = 'human-verify-note';
    note.innerHTML = "⚠️ Don't click login until you are verified as human";
    note.style.cssText = "background-color: #efe9de; color: #cc785c; padding: 10px 14px; margin: 12px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; text-align: center; border: 1px solid #e8e0d2;";
    var form = document.querySelector('form') || document.body;
    form.insertBefore(note, form.firstChild);
  })();
  true;
`;

interface WebViewScraperProps {
  webViewRef: React.RefObject<WebViewType | null>;
  webViewKey: number;
  isScrapingFinished: boolean;
  isLoggedIn: boolean;
  hasPreviousResult: boolean;
  onLoadStart: () => void;
  onNavigationStateChange: (navState: WebViewNavigation) => void;
  onMessage: (event: WebViewMessageEvent) => void;
  onError: () => void;
  onHttpError: (event: { nativeEvent: { statusCode: number } }) => void;
  onPreviousAttendance: () => void;
}

export function WebViewScraper({
  webViewRef,
  webViewKey,
  isScrapingFinished,
  isLoggedIn,
  hasPreviousResult,
  onLoadStart,
  onNavigationStateChange,
  onMessage,
  onError,
  onHttpError,
  onPreviousAttendance,
}: WebViewScraperProps) {
  const handleRefresh = () => {
    webViewRef.current?.reload();
  };

  return (
    <View style={isScrapingFinished ? styles.hiddenWebView : styles.fullWebView}>
      {!isScrapingFinished && (
        <>
          <WebView
            key={webViewKey}
            ref={webViewRef}
            source={{ uri: "https://jntuaceastudents.classattendance.in/" }}
            userAgent="Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            onLoadStart={onLoadStart}
            injectedJavaScript={INJECT_HUMAN_NOTE_JS}
            onNavigationStateChange={onNavigationStateChange}
            onMessage={onMessage}
            onError={onError}
            onHttpError={onHttpError}
            javaScriptEnabled
            domStorageEnabled
            incognito={false}
            style={{ flex: 1 }}
          />
          <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} activeOpacity={0.7}>
            <Text style={styles.refreshBtnText}>⟳</Text>
          </TouchableOpacity>
        </>
      )}

      {!isLoggedIn && hasPreviousResult && (
        <TouchableOpacity style={styles.prevBtn} onPress={onPreviousAttendance} activeOpacity={0.88}>
          <Text style={styles.prevBtnIcon}>↺</Text>
          <Text style={styles.prevBtnText}>Previous Attendance</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenWebView: { width: 0, height: 0, overflow: "hidden" },
  fullWebView: { flex: 1 },
  prevBtn: {
    position: "absolute",
    bottom: 56,
    left: 28,
    right: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 9999,
    elevation: 6,
    shadowColor: "#181715",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  prevBtnIcon: { color: COLORS.onDark, fontSize: 16, fontWeight: "700", marginRight: 8 },
  prevBtnText: { color: COLORS.onDark, fontWeight: "600", fontSize: 14, letterSpacing: 0.2 },
  refreshBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#181715",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  refreshBtnText: { color: COLORS.onDark, fontSize: 22, fontWeight: "700" },
});