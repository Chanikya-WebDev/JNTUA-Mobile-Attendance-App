import React, { useState, useRef, useContext } from 'react';
import {
  View, Text, ActivityIndicator, StatusBar, Alert, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { SCRAPER_SCRIPT } from '../lib/scraperScript';
import { OTAContext, OTAProvider } from '../context/OTAContext';
import AttendanceScreen from '../components/AttendanceScreen';
import { T, SP, COLORS } from '../lib/tokens';

export default function Index() {
  return (
    <OTAProvider bundledScript={SCRAPER_SCRIPT}>
      <IndexInner />
    </OTAProvider>
  );
}

function IndexInner() {
  const { script: otaScript, config } = useContext(OTAContext);
  const webViewRef = useRef<WebView>(null);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState('Please log in below');
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [scraped, setScraped] = useState(false);

  const activeScript = otaScript || SCRAPER_SCRIPT;

  const onNavStateChange = (navState: any) => {
    const url = navState.url.toLowerCase();
    if ((url.includes('studenthome') || url.includes('home')) && !scraped) {
      setScraped(true);
      setStatus('Scraping attendance...');
      if (webViewRef.current) webViewRef.current.injectJavaScript(activeScript);
    }
    if (url.includes('logout')) {
      setScraped(false);
      setAttendanceData(null);
      setStatus('Please log in below');
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'debug') console.log('[Scraper]', payload.message);
      else if (payload.type === 'attendance_complete') {
        setAttendanceData(payload);
        setStatus(`Loaded (${payload.subjects?.length || 0} subjects)`);
      } else if (payload.type === 'error') {
        Alert.alert('Scraper Error', payload.message);
        setStatus('Error: ' + payload.message);
        setScraped(false);
      }
    } catch (e) { console.warn('Message error:', e); }
  };

  const handleBack = () => { setAttendanceData(null); setScraped(false); setStatus('Please log in below'); };

  const retryScraper = () => {
    if (webViewRef.current) { setScraped(false); setStatus('Retrying...'); webViewRef.current.injectJavaScript(activeScript); }
  };

  if (attendanceData) {
    return <AttendanceScreen data={attendanceData} onBack={handleBack} bundledScript={activeScript} />;
  }

  const portalUrl = config?.portalUrl || 'https://jntuaceastudents.classattendance.in/';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.statusBar}>
        <View style={s.statusLeft}>
          <View style={[s.statusDot, { backgroundColor: scraped ? (attendanceData ? COLORS.green : COLORS.amber) : COLORS.textMut }]} />
          <Text style={s.statusText} numberOfLines={1}>{status}</Text>
        </View>
        {scraped && !attendanceData && (
          <TouchableOpacity onPress={retryScraper} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
      <WebView
        ref={webViewRef} source={{ uri: portalUrl }}
        javaScriptEnabled domStorageEnabled cacheEnabled={false}
        onMessage={handleMessage} onNavigationStateChange={onNavStateChange}
        renderLoading={() => (
          <View style={s.loaderWrap}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={[T.caption, { color: COLORS.textMut, marginTop: SP.lg }]}>Loading college portal...</Text>
          </View>
        )}
        onError={() => setError(true)}
        style={{ flex: 1, backgroundColor: COLORS.white }}
      />
      {error && (
        <View style={s.errorOverlay}>
          <View style={s.errorCard}>
            <Text style={[T.h1, { color: COLORS.red, marginBottom: SP.sm }]}>Connection Error</Text>
            <Text style={[T.caption, { color: COLORS.textMut, textAlign: 'center', marginBottom: SP.xl }]}>
              Failed to load the page. Check your internet and try again.
            </Text>
            <TouchableOpacity style={s.errorBtn} onPress={() => setError(false)}>
              <Text style={[T.body, { color: COLORS.white, fontWeight: '700' }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SP.xl, paddingVertical: SP.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: CARD_BORDER() },
  statusLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: SP.md },
  statusText: { ...T.caption, color: COLORS.textSec },
  retryBtn: { backgroundColor: COLORS.accent, paddingHorizontal: SP.xl, paddingVertical: SP.xs, borderRadius: 20 },
  retryText: { ...T.micro, color: COLORS.white },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  errorOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  errorCard: { backgroundColor: COLORS.white, padding: 28, borderRadius: 20, maxWidth: '80%', alignItems: 'center', elevation: 8 },
  errorBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 28, paddingVertical: SP.lg, borderRadius: 12 },
});

function CARD_BORDER() { return '#F1F5F9'; }
