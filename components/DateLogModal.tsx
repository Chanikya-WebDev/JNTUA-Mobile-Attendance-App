import React, { useMemo } from "react";
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { COLORS, SERIF } from "../constants/theme";
import type { AttendanceRecord, SubjectAttendanceData } from "../utils/automationScripts";

const STATUS_COLOR: Record<AttendanceRecord["status"], string> = {
  Present: COLORS.success,
  Absent: COLORS.error,
  Unknown: COLORS.muted,
};

interface DateLogModalProps {
  selectedSubject: SubjectAttendanceData | null;
  onClose: () => void;
}

function renderLogItem({ item }: ListRenderItemInfo<AttendanceRecord>) {
  return (
    <View style={styles.logRow}>
      <View>
        <Text style={styles.logDate}>{item.date}</Text>
        {!!item.time && <Text style={styles.logTime}>{item.time}</Text>}
      </View>
      <View style={styles.logBadge}>
        <Text style={[styles.logBadgeText, { color: STATUS_COLOR[item.status] }]}>
          {item.status}
        </Text>
      </View>
    </View>
  );
}

export function DateLogModal({ selectedSubject, onClose }: DateLogModalProps) {
  const records = useMemo(() => selectedSubject?.records ?? [], [selectedSubject]);

  return (
    <Modal visible={!!selectedSubject} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          {selectedSubject && (
            <>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {selectedSubject.subjectName}
                  </Text>
                  <Text style={styles.modalSub}>
                    Attendance log · {selectedSubject.present} attended, {selectedSubject.absent} missed
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeIcon} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close attendance log">
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={records}
                keyExtractor={(_, index) => index.toString()}
                renderItem={renderLogItem}
                showsVerticalScrollIndicator={false}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={5}
                removeClippedSubviews
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: COLORS.canvas,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: "78%",
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.creamStrong, alignSelf: "center", marginBottom: 14 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.hairlineSoft, marginBottom: 4 },
  modalTitle: { fontFamily: SERIF, fontSize: 19, letterSpacing: -0.3, color: COLORS.ink, lineHeight: 24 },
  modalSub: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  closeIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.hairline, backgroundColor: COLORS.canvas, alignItems: "center", justifyContent: "center" },
  closeIconText: { fontSize: 13, color: COLORS.body, fontWeight: "600" },
  logRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.hairlineSoft },
  logDate: { fontSize: 13, fontWeight: "500", color: COLORS.ink },
  logTime: { fontSize: 11.5, color: COLORS.mutedSoft, marginTop: 2 },
  logBadge: { backgroundColor: COLORS.surfaceCard, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 },
  logBadgeText: { fontSize: 11, fontWeight: "500" },
});