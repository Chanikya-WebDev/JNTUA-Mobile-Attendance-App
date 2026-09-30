import React, { memo, useCallback, useMemo } from "react";
import { FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { Spike } from "../components/Spike";
import { COLORS, GITHUB_URL, SERIF } from "../constants/theme";
import type { StudentInfo, SubjectAttendanceData } from "../utils/automationScripts";
import {
  ATTENDANCE_THRESHOLD,
  calculateCanSkip,
  calculateClassesToReach75,
  computeOverallStats,
  getLastAttendanceDate,
  sanitizePercentage,
} from "../utils/attendanceMath";

interface DashboardProps {
  studentInfo: StudentInfo | null;
  subjectsData: SubjectAttendanceData[];
  onSelectSubject: (item: SubjectAttendanceData) => void;
  onFullReset: () => void;
}

function getAttendanceColor(percentage: number): string {
  if (!Number.isFinite(percentage)) return COLORS.error;
  if (percentage < ATTENDANCE_THRESHOLD) return COLORS.error;
  if (percentage <= 77) return COLORS.amber;
  return COLORS.success;
}

interface SubjectCardProps {
  item: SubjectAttendanceData;
  maxOverallSkippable: number;
  onSelectSubject: (item: SubjectAttendanceData) => void;
}

const SubjectCard = memo(function SubjectCard({ item, maxOverallSkippable, onSelectSubject }: SubjectCardProps) {
  // Per-subject skip budget stays coupled to overall headroom.
  const pVal = sanitizePercentage(item.percentage);
  const isLow = pVal < ATTENDANCE_THRESHOLD;
  const canSkip = calculateCanSkip(item.present, item.total, maxOverallSkippable);
  const classesToReach75 = calculateClassesToReach75(item.present, item.total);
  const lastDate = getLastAttendanceDate(item.records);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.subjectCard}
      onPress={() => onSelectSubject(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.subjectName}, ${item.percentage} percent attendance`}
    >
      <View style={styles.subjectRow1}>
        <Text style={styles.subjectName} numberOfLines={2}>{item.subjectName}</Text>
        <Text style={[styles.subjectPct, { color: getAttendanceColor(pVal) }]}>{item.percentage}%</Text>
      </View>
      {lastDate && (
        <Text style={styles.subjectLastDate}>Last class · {lastDate}</Text>
      )}
      <View style={styles.subjectRow2}>
        <Text style={styles.shortStats}>
          Tot <Text style={styles.shortStatsBold}>{item.total}</Text>
          {" · "}Att <Text style={styles.shortStatsBold}>{item.present}</Text>
          {" · "}Abs <Text style={styles.shortStatsBold}>{item.absent}</Text>
        </Text>
        <View style={[styles.badgeCoral, canSkip <= 0 && styles.badgeMute]}>
          <Text style={[styles.badgeCoralText, canSkip <= 0 && styles.badgeMuteText]}>
            {isLow
              ? `Attend ${classesToReach75} more`
              : canSkip > 0
                ? `Skip ${canSkip} ${canSkip === 1 ? "class" : "classes"}`
                : "Keep attending"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export function Dashboard({
  studentInfo,
  subjectsData,
  onSelectSubject,
  onFullReset,
}: DashboardProps) {
  /* Aggregation math (pure helpers enable unit tests) */
  const {
    overallClasses,
    overallPresent,
    overallAbsent,
    overallPercentage,
    overallPercentageVal,
    isShortage,
    maxOverallSkippable,
  } = useMemo(() => computeOverallStats(subjectsData), [subjectsData]);

  const handleOpenGithub = useCallback((): void => {
    void Linking.canOpenURL(GITHUB_URL)
      .then((supported) => {
        if (supported) void Linking.openURL(GITHUB_URL);
      })
      .catch(() => undefined);
  }, []);

  const renderSubjectItem = useCallback(({ item }: ListRenderItemInfo<SubjectAttendanceData>) => (
    <SubjectCard item={item} maxOverallSkippable={maxOverallSkippable} onSelectSubject={onSelectSubject} />
  ), [maxOverallSkippable, onSelectSubject]);

  const listHeader = useMemo(() => (
    <View>
      {studentInfo && (
        <View style={styles.profileCard}>
          <Text style={styles.profileName} numberOfLines={1}>{studentInfo.name}</Text>
          <View style={styles.profileMetaRow}>
            <View style={styles.liveDot} />
            <Text style={styles.profileMeta} numberOfLines={1}>
              {studentInfo.admissionNo} • {studentInfo.className}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.overallCard}>
        <View style={styles.overallTopRow}>
          <Text style={styles.eyebrowSm}>OVERALL ATTENDANCE</Text>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>{isShortage ? "Shortage" : "Semester 1"}</Text>
          </View>
        </View>
        <Text style={[styles.bigPct, { color: getAttendanceColor(overallPercentageVal) }]}>
          {overallPercentage}
          <Text style={styles.bigPctSign}>%</Text>
        </Text>
        <View style={styles.miniStats}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatNum}>{overallClasses}</Text>
            <Text style={styles.miniStatLabel}>TOT</Text>
          </View>
          <View style={styles.miniDivider} />
          <View style={styles.miniStat}>
            <Text style={styles.miniStatNum}>{overallPresent}</Text>
            <Text style={styles.miniStatLabel}>ATT</Text>
          </View>
          <View style={styles.miniDivider} />
          <View style={styles.miniStat}>
            <Text style={styles.miniStatNum}>{overallAbsent}</Text>
            <Text style={styles.miniStatLabel}>ABS</Text>
          </View>
        </View>
        <View style={styles.skipRow}>
          <View>
            <Text style={styles.skipTitle}>Overall Safe to skip</Text>
            <Text style={styles.skipSub}>while staying above 75%</Text>
          </View>
          <View style={[styles.badgeCoral, maxOverallSkippable <= 0 && styles.badgeMute]}>
            <Text style={[styles.badgeCoralText, maxOverallSkippable <= 0 && styles.badgeMuteText]}>
              {maxOverallSkippable} {maxOverallSkippable === 1 ? "class" : "classes"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.listHead}>
        <Text style={styles.eyebrowSm}>SUBJECTS</Text>
        <Text style={styles.listCount}>{subjectsData.length}</Text>
      </View>
    </View>
  ), [studentInfo, subjectsData.length, overallClasses, overallPresent, overallAbsent, overallPercentage, overallPercentageVal, isShortage, maxOverallSkippable]);

  const listFooter = useMemo(() => (
    <View style={styles.footBand}>
      <Spike size={15} color={COLORS.onDark} />
      <Text style={styles.footTitle}>Open to Contribute</Text>
      <Text style={styles.footSub}>{"Found a bug or have an idea?\nThis app is open source."}</Text>
      <TouchableOpacity style={styles.btnCoral} activeOpacity={0.85} onPress={handleOpenGithub} accessibilityRole="link" accessibilityLabel="View source on GitHub">
        <Text style={styles.btnCoralText}>View on GitHub</Text>
      </TouchableOpacity>
      <Text style={styles.footCredit}>
        Crafted by <Text style={styles.footCreditName}>J Chanikya</Text> · 2026
      </Text>
    </View>
  ), [handleOpenGithub]);

  return (
    <View style={styles.dashboardContainer}>
      <View style={styles.sigRow}>
        <View style={styles.wordmark}>
          <Spike />
          <Text style={styles.wordmarkText}>Chanikya</Text>
          <Text style={styles.wordmarkRole}>·dev</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={onFullReset} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Reset and reload attendance">
          <Text style={styles.iconBtnText}>↺</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={subjectsData}
        keyExtractor={(item, index) =>
          item.subCode && item.subCode.length > 0
            ? `${item.subCode}-${index}`
            : `${item.subjectName}-${index}`
        }
        renderItem={renderSubjectItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dashboardContainer: { flex: 1, paddingHorizontal: 20 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, marginBottom: 4 },
  wordmark: { flexDirection: "row", alignItems: "center" },
  wordmarkText: { fontFamily: SERIF, fontStyle: "italic", fontSize: 23, letterSpacing: -0.4, color: COLORS.ink, marginLeft: 8 },
  wordmarkRole: { fontSize: 10, fontWeight: "500", letterSpacing: 1.4, color: COLORS.mutedSoft, marginLeft: 7, marginTop: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.hairline, alignItems: "center", justifyContent: "center" },
  iconBtnText: { fontSize: 15, color: COLORS.body, fontWeight: "600" },
  profileCard: { backgroundColor: COLORS.surfaceDark, borderRadius: 12, padding: 18, marginBottom: 12 },
  profileName: { fontFamily: SERIF, fontSize: 24, letterSpacing: -0.5, color: COLORS.onDark },
  profileMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.live, marginRight: 7 },
  profileMeta: { fontSize: 12.5, color: COLORS.onDarkSoft },
  overallCard: { backgroundColor: COLORS.surfaceCard, borderRadius: 12, padding: 20, marginBottom: 12 },
  overallTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  eyebrowSm: { fontSize: 10.5, fontWeight: "500", letterSpacing: 1.5, color: COLORS.muted },
  badgePill: { backgroundColor: COLORS.creamStrong, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 },
  badgePillText: { fontSize: 11, fontWeight: "500", color: COLORS.ink },
  bigPct: { fontFamily: SERIF, fontSize: 52, letterSpacing: -1.5, color: COLORS.ink, lineHeight: 56, marginVertical: 4 },
  bigPctSign: { fontSize: 24, color: COLORS.muted },
  miniStats: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.hairline, paddingTop: 12, marginTop: 8 },
  miniStat: { flex: 1, alignItems: "center" },
  miniStatNum: { fontFamily: SERIF, fontSize: 18, color: COLORS.body },
  miniStatLabel: { fontSize: 9.5, fontWeight: "500", letterSpacing: 1.2, color: COLORS.muted, marginTop: 3 },
  miniDivider: { width: 1, backgroundColor: COLORS.hairlineSoft },
  skipRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: COLORS.hairline, marginTop: 12, paddingTop: 12 },
  skipTitle: { fontSize: 13, fontWeight: "500", color: COLORS.body },
  skipSub: { fontSize: 10.5, color: COLORS.muted, marginTop: 2 },
  badgeCoral: { backgroundColor: COLORS.primary, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeCoralText: { fontSize: 11, fontWeight: "500", letterSpacing: 0.4, color: COLORS.onDark },
  badgeMute: { backgroundColor: COLORS.creamStrong },
  badgeMuteText: { color: COLORS.muted },
  listHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginVertical: 8, paddingHorizontal: 2 },
  listCount: { fontSize: 12, color: COLORS.mutedSoft },
  subjectCard: { backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 12, padding: 16, marginBottom: 10 },
  subjectRow1: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  subjectName: { flex: 1, fontSize: 14.5, fontWeight: "500", color: COLORS.ink, lineHeight: 20, marginRight: 10 },
  subjectPct: { fontFamily: SERIF, fontSize: 24, letterSpacing: -0.5, color: COLORS.ink },
  subjectLastDate: { fontSize: 11.5, fontWeight: "600", color: COLORS.body, marginTop: 8 },
  subjectRow2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  shortStats: { fontSize: 11.5, color: COLORS.muted },
  shortStatsBold: { fontWeight: "600", color: COLORS.body },
  footBand: { backgroundColor: COLORS.surfaceDark, borderRadius: 12, padding: 24, alignItems: "center", marginTop: 6, marginBottom: 8 },
  footTitle: { fontFamily: SERIF, fontSize: 21, letterSpacing: -0.3, color: COLORS.onDark, marginTop: 10 },
  footSub: { fontSize: 12.5, lineHeight: 19, color: COLORS.onDarkSoft, marginTop: 8, textAlign: "center" },
  btnCoral: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, marginTop: 14, alignSelf: "stretch", alignItems: "center" },
  btnCoralText: { fontSize: 14, fontWeight: "500", color: COLORS.onDark },
  footCredit: { fontSize: 11.5, color: COLORS.mutedSoft, marginTop: 14 },
  footCreditName: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: COLORS.primary },
});