import { Search } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CARD, COLORS, isSmall } from '../lib/tokens';

interface Props { value: string; onChangeText: (text: string) => void; placeholder?: string; }

export default function SearchBar({ value, onChangeText, placeholder = 'Search subject...' }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.box}>
        <Search size={isSmall ? 16 : 18} color={COLORS.textMut} />
        <TextInput style={s.input} placeholder={placeholder} placeholderTextColor={COLORS.textMut}
          value={value} onChangeText={onChangeText} accessibilityLabel="Search subjects" />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')} style={s.clearBtn}>
            <Text style={s.clearText}>X</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}


const s = StyleSheet.create({
  wrap: { paddingHorizontal: isSmall ? 10 : 12, marginBottom: isSmall ? 10 : 12 },
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: CARD.radius, borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.white, paddingHorizontal: isSmall ? 8 : 10, paddingVertical: isSmall ? 4 : 5, elevation: 1 },
  input: { flex: 1, paddingHorizontal: isSmall ? 4 : 6, fontSize: isSmall ? 11 : 12, color: COLORS.text },
  clearBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 9, color: COLORS.textMut, fontWeight: '700' },
});
