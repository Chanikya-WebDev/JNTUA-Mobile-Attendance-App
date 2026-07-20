import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useOTAConfig } from '../hooks/useOTAConfig';
import { isSmall } from '../lib/tokens';

export default function QuickTip() {
  const { config } = useOTAConfig();
  const { thresholds, showQuickTip, quickTipText } = config;
  if (!showQuickTip) return null;

  const defaultTip = `The ${thresholds.minimum}% rule means for every 3 classes you miss, you need to attend 9 more to compensate. Green bars are above ${thresholds.safe}% (safe zone), amber at ${thresholds.minimum}–${thresholds.safe}% (at risk), and red means immediate action needed.`;
  const tipText = quickTipText || defaultTip;

  return (
    <View style={s.wrap}>
      <View style={s.iconBox}>
        <Text style={s.iconLetter}>💡</Text>
      </View>
      <View style={s.textWrap}>
        <Text style={s.title}>Quick Tip</Text>
        <Text style={s.body}>{tipText}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: isSmall ? 12 : 16,
    marginTop: isSmall ? 12 : 16,
    padding: isSmall ? 12 : 14,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: isSmall ? 26 : 30,
    height: isSmall ? 26 : 30,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isSmall ? 10 : 12,
  },
  iconLetter: { fontSize: isSmall ? 12 : 14 },
  textWrap: { flex: 1 },
  title: {
    fontSize: isSmall ? 11 : 12,
    fontWeight: '700',
    color: '#14532D',
    marginBottom: 3,
  },
  body: {
    fontSize: isSmall ? 10 : 11,
    color: '#166534',
    lineHeight: isSmall ? 14 : 16,
  },
});
