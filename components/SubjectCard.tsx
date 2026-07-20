import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useOTAConfig } from '../hooks/useOTAConfig';
import { COLORS, isSmall } from '../lib/tokens';

interface Props {
  subject: string; code: string; total: number; present: number;
  absent: number; percentage: number; startDate: string | null;
  endDate: string | null; onPress?: () => void;
}

export default function SubjectCard({ subject, code, total, present, absent, percentage, startDate, endDate, onPress }: Props) {
  const { config } = useOTAConfig();
  const { thresholds, colors } = config;

  let zone: 'safe' | 'caution' | 'risk' | 'danger' = 'danger';
  if (percentage >= thresholds.safe) zone = 'safe';
  else if (percentage >= thresholds.minimum) zone = 'caution';
  else if (percentage >= thresholds.warning) zone = 'risk';

  const pc = colors[zone === 'risk' ? 'warning' : zone];
  const barColor = zone === 'safe' ? '#059669' : zone === 'caution' ? '#D97706' : zone === 'risk' ? '#D97706' : '#DC2626';
  const pillGreen = '#F0FDF4';
  const pillGreenBorder = '#BBF7D0';
  const pillGreenText = '#15803D';
  const pillRed = '#FFF1F2';
  const pillRedBorder = '#FECDD3';
  const pillRedText = '#9F1239';
  const pillAmber = '#FFFBEB';
  const pillAmberBorder = '#FDE68A';
  const pillAmberText = '#92400E';

  const minPct = thresholds.minimum / 100;
  let canSkip = 0, needAttend = 0;
  if (total > 0) {
    if (percentage >= thresholds.minimum) { canSkip = Math.floor((present / minPct) - total); if (canSkip < 0) canSkip = 0; }
    else { needAttend = Math.ceil((minPct * total - present) / (1 - minPct)); if (needAttend < 0) needAttend = 0; }
  }

  const dateRange = startDate && endDate ? `${startDate} – ${endDate}` : null;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={s.card}>
      <View style={[s.cardBar, { backgroundColor: barColor }]} />
      <View style={s.cardInner}>
        {/* Percentage Block */}
        <View style={s.pctBlock}>
          <Text style={[s.pctNum, { color: pc }]}>{percentage}%</Text>
          <Text style={s.pctLabel}>Attend</Text>
        </View>

        <View style={s.vr} />

        {/* Subject Content */}
        <View style={s.subjContent}>
          <Text style={s.subjName} numberOfLines={1}>{subject}</Text>
          <View style={s.metaRow}>
            <View style={[s.pill, { backgroundColor: COLORS.bg, borderColor: COLORS.borderLight }]}>
              <Text style={[s.pillText, { color: COLORS.textSec }]}>{total} hrs total</Text>
            </View>
            <View style={[s.pill, { backgroundColor: pillGreen, borderColor: pillGreenBorder }]}>
              <Text style={[s.pillText, { color: pillGreenText }]}>✓ {present} present</Text>
            </View>
            <View style={[s.pill, { backgroundColor: pillRed, borderColor: pillRedBorder }]}>
              <Text style={[s.pillText, { color: pillRedText }]}>✗ {absent} absent</Text>
            </View>
            {percentage >= thresholds.minimum && canSkip > 0 && (
              <View style={[s.pill, { backgroundColor: pillGreen, borderColor: pillGreenBorder }]}>
                <Text style={[s.pillText, { color: pillGreenText }]}>Can Skip {canSkip}</Text>
              </View>
            )}
            {percentage < thresholds.minimum && needAttend > 0 && (
              <View style={[s.pill, { backgroundColor: pillAmber, borderColor: pillAmberBorder }]}>
                <Text style={[s.pillText, { color: pillAmberText }]}>Need {needAttend} more</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right Section */}
        <View style={s.subjRight}>
          {dateRange && (
            <View style={[s.dateChip, { backgroundColor: COLORS.bg, borderColor: COLORS.borderLight }]}>
              <Text style={[s.dateText, { color: COLORS.textSec }]}>{dateRange}</Text>
            </View>
          )}
          <Text style={s.spanTxt}>{percentage >= thresholds.minimum ? 'On track' : 'Below threshold'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: isSmall ? 10 : 12,
    marginBottom: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
    flexDirection: 'row',
    elevation: 2,
  },
  cardBar: {
    width: 3,
  },
  cardInner: {
    flex: 1,
    padding: isSmall ? 8 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmall ? 8 : 10,
  },
  pctBlock: {
    width: isSmall ? 36 : 44,
    alignItems: 'center',
  },
  pctNum: {
    fontSize: isSmall ? 14 : 16,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: isSmall ? 14 : 16,
  },
  pctLabel: {
    fontSize: isSmall ? 6 : 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.textMut,
    marginTop: 2,
  },
  dateChip: {
    marginTop: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  dateText: {
    fontSize: isSmall ? 6 : 7,
    color: COLORS.textMut,
    fontWeight: '600',
  },
  vr: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#EEF0F5',
  },
  subjContent: {
    flex: 1,
  },
  subjName: {
    fontSize: isSmall ? 12 : 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: isSmall ? 4 : 6,
    paddingVertical: isSmall ? 1 : 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  pillText: {
    fontSize: isSmall ? 8 : 9,
    fontWeight: '600',
  },
  subjRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  spanTxt: {
    fontSize: isSmall ? 8 : 9,
    color: COLORS.textMut,
    fontWeight: '500',
  },
});
