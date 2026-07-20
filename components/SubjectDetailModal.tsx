import React from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CARD, COLORS, isSmall } from '../lib/tokens';

interface Props { visible: boolean; onClose: () => void; subject: string; code: string; percentage: number; present: number; absent: number; total: number; records: { date: string; status: string }[]; }
export default function SubjectDetailModal({ visible, onClose, subject, code, percentage, present, absent, total, records }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modalBox}>
          <View style={s.modalHead}>
            <View>
              <Text style={s.modalTitle}>{subject}</Text>
              <Text style={s.modalSub}>{code}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.modalClose}>
              <Text style={s.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
          
         
          <FlatList 
            data={records} 
            keyExtractor={(item, index) => `${item.date}-${index}`} 
            ListEmptyComponent={<Text style={s.empty}>No attendance records available.</Text>} 
            renderItem={({ item }) => { 
              const isPresent = item.status.toLowerCase().includes('present'); 
              return (
                <View style={s.modalRow}>
                  <Text style={s.modalDate}>{item.date}</Text>
                  <View style={[s.statusPill, isPresent ? s.pillGreen : s.pillRed]}>
                    <Text style={[s.statusText, { color: isPresent ? '#15803D' : '#9F1239' }]}>
                      {isPresent ? '✓' : '✗'} {item.status}
                    </Text>
                  </View>
                </View>
              ); 
            }} 
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isSmall ? 12 : 16,
  },
  modalBox: {
    backgroundColor: COLORS.white,
    borderRadius: isSmall ? 16 : 18,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.12,
    shadowRadius: 60,
    elevation: 24,
  },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmall ? 14 : 18,
    paddingBottom: isSmall ? 12 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F5',
  },
  modalTitle: {
    fontSize: isSmall ? 14 : 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: isSmall ? 11 : 12,
    color: COLORS.textMut,
    marginTop: 2,
  },
  modalClose: {
    width: isSmall ? 28 : 32,
    height: isSmall ? 28 : 32,
    borderRadius: isSmall ? 7 : 8,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    backgroundColor: '#F4F6F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: isSmall ? 14 : 16,
    color: COLORS.textMut,
    fontWeight: '600',
  },
  summary: {
    backgroundColor: COLORS.white,
    borderRadius: CARD.radius,
    borderWidth: 2,
    padding: isSmall ? 12 : 16,
    marginHorizontal: isSmall ? 12 : 20,
    marginTop: isSmall ? 12 : 16,
    marginBottom: isSmall ? 12 : 16,
    alignItems: 'center',
  },
  summaryPercent: {
    fontSize: isSmall ? 0 : 0,
    fontWeight: '800',
  },
  summaryText: {
    fontSize: isSmall ? 12 : 13,
    color: COLORS.textMut,
    marginTop: 4,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isSmall ? 8 : 9,
    paddingHorizontal: isSmall ? 12 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F5',
  },
  modalDate: {
    fontSize: isSmall ? 13 : 14,
    color: COLORS.textSec,
    fontWeight: '500',
  },
  statusPill: {
    paddingHorizontal: isSmall ? 8 : 10,
    paddingVertical: isSmall ? 3 : 4,
    borderRadius: 20,
  },
  pillGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
  },
  pillRed: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
    borderWidth: 1,
  },
  statusText: {
    fontSize: isSmall ? 10 : 11,
    fontWeight: '700',
  },
  empty: {
    fontSize: isSmall ? 13 : 14,
    color: COLORS.textMut,
    textAlign: 'center',
    marginTop: 32,
    padding: isSmall ? 20 : 32,
  },
});
