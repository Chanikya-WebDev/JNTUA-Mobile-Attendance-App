import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, isSmall } from '../lib/tokens';

interface Props { name: string; studentId: string; semester: string; }

export default function GradientHeader({ name, studentId, semester }: Props) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <View style={s.wrap}>
      <View style={s.eyebrow}>
        <View style={s.eyebrowDot} />
        <Text style={s.eyebrowText}>JNTUA · Attendance Dashboard</Text>
      </View>
      <View style={s.headerRow}>
        <View style={s.avatar}>
          <Text style={s.avatarLetter}>{initial}</Text>
        </View>
        <View style={s.headerText}>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          <Text style={s.uid}>Student ID: {studentId}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: isSmall ? 12 : 16,
    paddingTop: isSmall ? 20 : 28,
    paddingBottom: isSmall ? 24 : 36,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: isSmall ? 8 : 12,
  },
  eyebrowDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22C55E',
  },
  eyebrowText: {
    fontSize: isSmall ? 9 : 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLORS.textMut,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: isSmall ? 12 : 18,
  },
  avatar: {
    width: isSmall ? 44 : 52,
    height: isSmall ? 44 : 52,
    borderRadius: isSmall ? 12 : 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: isSmall ? 18 : 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: isSmall ? 18 : 22,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: isSmall ? 20 : 24,
    color: COLORS.text,
    textTransform: 'uppercase',
  },
  uid: {
    fontSize: isSmall ? 11 : 12,
    color: COLORS.textMut,
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
