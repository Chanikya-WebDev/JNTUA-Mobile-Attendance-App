import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Consider splitting into `store/attendanceStore.ts` for better separation of concerns.

interface Subject {
  subject: string;
  code: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
  records: { date: string; status: string }[];
  error?: string;
}

interface Overall {
  totalDays: number;
  totalPresent: number;
  overallPercent: number;
}

interface AttendanceData {
  type: string;
  semester: string;
  subjects: Subject[];
  overall: Overall;
}

interface AttendanceState {
  data: AttendanceData | null;
  setData: (data: AttendanceData) => void;
  clearData: () => void;
}

// Debug logging for Zustand store
type AttendanceStoreCreator = StateCreator<AttendanceState, [], [], AttendanceState>;

const storeLogger = (config: AttendanceStoreCreator): AttendanceStoreCreator => (set, get, api) =>
  config((partial, replace) => {
    console.log('Zustand store action:', partial);
    if (replace) {
      set(partial as AttendanceState | ((state: AttendanceState) => AttendanceState), true);
      return;
    }
    set(partial as Partial<AttendanceState> | ((state: AttendanceState) => Partial<AttendanceState>), false);
  }, get, api);

const attendanceStoreCreator: AttendanceStoreCreator = (set) => ({
  data: null,
  setData: (data) => {
    console.log('Zustand: Setting attendance data:', data);
    set({ data });
  },
  clearData: () => {
    console.log('Zustand: Clearing attendance data');
    set({ data: null });
  },
});

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    storeLogger(attendanceStoreCreator),
    {
      name: 'attendance-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
