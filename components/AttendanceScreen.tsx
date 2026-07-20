import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OTAProvider } from '../context/OTAContext';
import { COLORS, SP, T } from '../lib/tokens';
import GradientHeader from './GradientHeader';
import QuickTip from './QuickTip';
import SearchBar from './SearchBar';
import StatsHeader from './StatsHeader';
import SubjectCard from './SubjectCard';
import SubjectDetailModal from './SubjectDetailModal';

interface SubjectItem {
  subject: string; code: string; total: number; present: number;
  absent: number; percentage: number;
  records: { date: string; status: string }[]; error?: string;
}

interface AttendanceScreenProps {
  data: { semester: string; subjects: SubjectItem[]; overall: { totalDays: number; totalPresent: number; overallPercent: number }; studentName?: string; studentId?: string };
  onBack: () => void;
  bundledScript: string;
}

export default function AttendanceScreen({ data, onBack, bundledScript }: AttendanceScreenProps) {
  return (
    <OTAProvider bundledScript={bundledScript}>
      <Inner data={data} onBack={onBack} />
    </OTAProvider>
  );
}

function Inner({ data, onBack }: Omit<AttendanceScreenProps, 'bundledScript'>) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SubjectItem | null>(null);
  const studentName = data.studentName || 'Student';
  const studentId = data.studentId || '--';

  const filtered = useMemo(() => {
    if (!data?.subjects) return [];
    return data.subjects.filter((s) => s.subject.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  const ListHeader = (
    <>
      <GradientHeader name={studentName} studentId={studentId} semester={data.semester} />
      <StatsHeader totalSubjects={data.subjects.length} avgPercent={data.overall.overallPercent} totalPresent={data.overall.totalPresent} totalDays={data.overall.totalDays} />
      <View style={s.sectionHead}>
        <Text style={s.shLabel}>Subject-wise Attendance</Text>
        <View style={s.shLine} />
        <View style={[s.shBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
          <Text style={[s.shBadgeText, { color: '#1D4ED8' }]}>{data.subjects.length} subjects</Text>
        </View>
      </View>
      <QuickTip />
      <SearchBar value={search} onChangeText={setSearch} />
    </>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Attendance Dashboard</Text>
        <View style={{ width: 34 }} />
      </View>
      <FlatList
        data={filtered} keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <SubjectCard subject={item.subject} code={item.code} total={item.total} present={item.present} absent={item.absent} percentage={item.percentage}
            startDate={item.records?.[0]?.date || null} endDate={item.records?.[item.records.length - 1]?.date || null}
            onPress={() => setSelected(item)} />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={<View style={s.empty}><Text style={[T.h2, { color: COLORS.textMut }]}>No subjects found</Text><Text style={[T.caption, { color: COLORS.textFaint, marginTop: SP.xs }]}>Try a different search term</Text></View>}
        contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      />
      <SubjectDetailModal visible={selected !== null} onClose={() => setSelected(null)}
        subject={selected?.subject || ''} code={selected?.code || ''} percentage={selected?.percentage || 0}
        present={selected?.present || 0} absent={selected?.absent || 0} total={selected?.total || 0} records={selected?.records || []} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textMut, fontWeight: '700' },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  shLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: COLORS.textMut,
  },
  shLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  shBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  shBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  empty: { paddingVertical: 48, alignItems: 'center' },
});
