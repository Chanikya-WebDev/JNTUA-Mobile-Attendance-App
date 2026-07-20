import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, isSmall } from '../lib/tokens';

interface Props {
  totalSubjects: number;
  avgPercent: number;
  totalPresent: number;
  totalDays: number;
}

export default function StatsHeader({ totalSubjects, avgPercent, totalPresent, totalDays }: Props) {

  const percentColor = avgPercent >= 75 ? '#059669' : '#DC2626';

  return (
    <View style={s.statRow}>
      <View style={s.stat}>
        <Text style={s.statVal}>{totalSubjects}</Text>
        <Text style={s.statLabel}>Subjects</Text>
      </View>
      <View style={s.statSep} />
      <View style={s.stat}>
        <Text style={[s.statVal, { color: percentColor }]}>{avgPercent}%</Text>
        <Text style={s.statLabel}>Avg Attendance</Text>
      </View>
      <View style={s.statSep} />
      <View style={s.stat}>
        <Text style={s.statVal}>{totalPresent}</Text>
        <Text style={s.statLabel}>Attended</Text>
      </View>
      <View style={s.statSep} />
      <View style={s.stat}>
        <Text style={s.statVal}>{totalDays}</Text>
        <Text style={s.statLabel}>Conducted</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    gap: isSmall ? 6 : 12,
    marginTop: isSmall ? 2 : 2,
    alignItems: 'center',
    paddingHorizontal: isSmall ? 8 : 12,
  },
  stat: {
    flexDirection: 'column',
    gap: 2,
  },
  statVal: {
    fontSize: isSmall ? 14 : 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
    lineHeight: isSmall ? 14 : 16,
  },
  statValGreen: { color: '#059669' },
  statValRed: { color: '#DC2626' },
  statLabel: {
    fontSize: isSmall ? 7 : 8,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: COLORS.textMut,
    marginTop: 2,
  },
  statSep: {
    width: 1,
    height: isSmall ? 14 : 18,
    backgroundColor: COLORS.borderLight,
    alignSelf: 'center',
  },
});
