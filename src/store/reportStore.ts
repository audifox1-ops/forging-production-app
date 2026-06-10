import { create } from 'zustand';
import { ProductionReport, ProductionEntry, EquipmentTarget, User, ProductionPeriodTarget, PeriodTargetType, Equipment, Shift, EQUIPMENT_LIST, SHIFT_LIST } from '../types';
import {
  DEMO_REPORTS,
  DEMO_ENTRIES,
  DEMO_TARGETS,
  DEMO_PERIOD_TARGETS,
  DEMO_USERS,
} from '../lib/mockData';
import { format } from 'date-fns';
import {
  deleteSupabaseRows,
  getInitialStorageMode,
  getStorageErrorMessage,
  loadLocalReportState,
  loadSupabaseReportState,
  PersistedReportState,
  saveLocalReportState,
  saveSupabaseReportState,
  StorageMode,
  upsertSupabaseRows,
} from './persistence';
import { getPlanDateFromActualDate } from '../utils/reportDates';
import {
  ANNUAL_TARGET_TOTALS_2026,
  SHIFT_TARGETS_2026_BY_EQUIPMENT,
  TARGET_EQUIPMENT_LIST,
  TargetEquipment,
} from '../utils/targetConfig';

interface CreateReportOptions {
  sourceReportDate?: string;
}

interface ReportStore {
  reports: ProductionReport[];
  entries: ProductionEntry[];
  targets: EquipmentTarget[];
  periodTargets: ProductionPeriodTarget[];
  users: User[];
  currentUserId: string;
  storageMode: StorageMode;
  hasHydrated: boolean;
  isHydrating: boolean;
  syncError?: string;
  lastSyncedAt?: string;

  // 보고서 관련
  getReport: (reportDate: string) => ProductionReport | undefined;
  createReport: (reportDate: string, options?: CreateReportOptions) => ProductionReport;

  // 실적 항목 관련
  getEntriesByReport: (reportId: string) => ProductionEntry[];
  getEntryByUserEquipmentShift: (reportId: string, userId: string, equipment: string, shift: string) => ProductionEntry | undefined;
  saveEntry: (entry: Partial<ProductionEntry> & { report_id: string; equipment: string; shift: string; user_id: string }) => void;
  submitEntry: (entryId: string) => void;
  returnEntry: (entryId: string) => void;
  approveEntry: (entryId: string) => void;

  // 목표값 관련
  getTargets: () => EquipmentTarget[];
  updateTarget: (equipment: string, shift: string, productTarget: number, billetTarget: number) => void;
  getPeriodTargets: () => ProductionPeriodTarget[];
  updatePeriodTarget: (period: PeriodTargetType, productTarget: number, billetTarget: number) => void;

  // 유저 관련
  setCurrentUserId: (userId: string) => void;
  getCurrentUser: () => User | undefined;
  getUsers: () => User[];
  updateUser: (userId: string, updates: Partial<User>) => void;
  addUser: (user: Omit<User, 'id' | 'created_at'>) => void;
  deleteUser: (userId: string) => void;
  hydrateStorage: () => Promise<void>;
}

let nextId = 100;
const genId = () => globalThis.crypto?.randomUUID?.() ?? `gen-${++nextId}`;
let remoteWriteQueue: Promise<void> = Promise.resolve();

const LOCAL_STATE = loadLocalReportState();

const getInitialArray = <T>(localValue: T[] | undefined, fallback: T[]) =>
  Array.isArray(localValue) ? localValue : [...fallback];

const normalizeReports = (reports: ProductionReport[]) =>
  reports.map(report =>
    (report as { status: string }).status === 'closed'
      ? { ...report, status: 'reviewed' as const }
      : report
  );

const PREVIOUS_2026_TARGETS_BY_EQUIPMENT: Record<TargetEquipment, { product: number; billet: number }> = {
  P15: { product: 17545, billet: 18150 },
  P5: { product: 8470, billet: 6070 },
  'R/M': { product: 23985, billet: 0 },
};

const ACTUAL_ONLY_EQUIPMENT: Equipment[] = ['P8'];

const isTargetEquipment = (equipment: Equipment): equipment is TargetEquipment =>
  TARGET_EQUIPMENT_LIST.includes(equipment as TargetEquipment);

const isActualOnlyEquipment = (equipment: Equipment) =>
  ACTUAL_ONLY_EQUIPMENT.includes(equipment);

const PREVIOUS_2026_ANNUAL_TARGETS = {
  product: 24200000,
  billet: 11722480,
};

const normalizeTargetDefaults = (targets: EquipmentTarget[]) => {
  let changed = false;
  const value = targets.map(target => {
    if (!isTargetEquipment(target.equipment)) return target;

    const previousTarget = PREVIOUS_2026_TARGETS_BY_EQUIPMENT[target.equipment];
    const newDefault = SHIFT_TARGETS_2026_BY_EQUIPMENT[target.equipment];
    const isPrevious2026Target = target.effective_date === '2026-01-01' &&
      target.product_target === previousTarget.product &&
      target.billet_target === previousTarget.billet;

    if (!isPrevious2026Target) return target;

    changed = true;
    return {
      ...target,
      product_target: newDefault.product,
      billet_target: newDefault.billet,
    };
  });

  return { value, changed };
};

const normalizePeriodTargetDefaults = (periodTargets: ProductionPeriodTarget[]) => {
  let changed = false;
  const value = periodTargets.map(target => {
    const isPreviousYearlyDefault = target.period === 'yearly' &&
      target.effective_date === '2026-01-01' &&
      (
        (target.product_target === 0 && target.billet_target === 0) ||
        (
          target.product_target === PREVIOUS_2026_ANNUAL_TARGETS.product &&
          target.billet_target === PREVIOUS_2026_ANNUAL_TARGETS.billet
        )
      );

    if (!isPreviousYearlyDefault) return target;

    changed = true;
    return {
      ...target,
      product_target: ANNUAL_TARGET_TOTALS_2026.product,
      billet_target: ANNUAL_TARGET_TOTALS_2026.billet,
    };
  });

  return { value, changed };
};

const addEquipment = (equipmentList: Equipment[], equipment: Equipment) =>
  equipmentList.includes(equipment) ? equipmentList : [...equipmentList, equipment];

const normalizeUserDefaults = (users: User[]) => {
  let changed = false;
  const value = users.map(user => {
    const shouldAddP8 =
      user.email === 'admin@forging.com' ||
      user.email === 'hoegeun.kim@forging.com' ||
      user.email === 'eunseo.lee@forging.com' ||
      user.email === 'jaehan.woo@forging.com';

    if (!shouldAddP8 || user.assigned_equipment.includes('P8')) return user;

    changed = true;
    const assigned_equipment = user.email === 'jaehan.woo@forging.com'
      ? addEquipment(addEquipment(user.assigned_equipment, 'R/M'), 'P8')
      : addEquipment(user.assigned_equipment, 'P8');

    return { ...user, assigned_equipment };
  });

  return { value, changed };
};

const INITIAL_ASSIGNEES_BY_EQUIPMENT: Record<Equipment, { email: string; fallbackUserId: string; userName: string }> = {
  P15: { email: 'hyun.kim@forging.com', fallbackUserId: 'user-kim-hyun', userName: '김현 차장' },
  P5: { email: 'byeongjun.koo@forging.com', fallbackUserId: 'user-koo-byeongjun', userName: '구병준 차장' },
  'R/M': { email: 'jaehan.woo@forging.com', fallbackUserId: 'user-woo-jaehan', userName: '우재한 과장' },
  P8: { email: 'jaehan.woo@forging.com', fallbackUserId: 'user-woo-jaehan', userName: '우재한 과장' },
};

export const useReportStore = create<ReportStore>((set, get) => {
  const getPersistedState = (): PersistedReportState => {
    const state = get();
    return {
      reports: state.reports,
      entries: state.entries,
      targets: state.targets,
      periodTargets: state.periodTargets,
      users: state.users,
      currentUserId: state.currentUserId,
    };
  };

  const persistCurrentState = (syncRemote = true, remoteOperation?: () => Promise<void>) => {
    const snapshot = getPersistedState();
    saveLocalReportState(snapshot);

    if (!syncRemote || !remoteOperation || get().storageMode !== 'supabase') return;

    const queuedOperation = remoteWriteQueue
      .catch(() => undefined)
      .then(remoteOperation);

    remoteWriteQueue = queuedOperation;

    void queuedOperation
      .then(() => {
        set({ lastSyncedAt: new Date().toISOString(), syncError: undefined });
      })
      .catch(error => {
        set({ syncError: getStorageErrorMessage(error) });
      });
  };

  const getSourceReport = (reportDate: string, options?: CreateReportOptions) => {
    if (options?.sourceReportDate) {
      return get().getReport(options.sourceReportDate);
    }

    return [...get().reports]
      .filter(report => report.report_date < reportDate)
      .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())[0];
  };

  const resolveCurrentUserId = (users: User[], currentUserId: string) => {
    if (users.some(user => user.id === currentUserId)) return currentUserId;
    return users.find(user => user.role === 'admin')?.id ?? users[0]?.id ?? currentUserId;
  };

  const buildDefaultEntry = (
    reportId: string,
    equipment: Equipment,
    shift: Shift,
    sourceEntries: ProductionEntry[]
  ): ProductionEntry => {
    const currentTarget = get().targets.find(item => item.equipment === equipment && item.shift === shift);
    const sourceEntry = sourceEntries.find(entry => entry.equipment === equipment && entry.shift === shift);
    const initialAssignee = INITIAL_ASSIGNEES_BY_EQUIPMENT[equipment];
    const assignedUser = get().users.find(user => user.email === initialAssignee.email);
    const actualOnly = isActualOnlyEquipment(equipment);

    return {
      id: genId(),
      report_id: reportId,
      user_id: assignedUser?.id ?? initialAssignee.fallbackUserId,
      user_name: assignedUser?.name ?? initialAssignee.userName,
      equipment,
      shift,
      product_plan: actualOnly ? 0 : sourceEntry?.next_product_plan ?? currentTarget?.product_target ?? 0,
      product_actual: 0,
      billet_plan: actualOnly ? 0 : sourceEntry?.next_billet_plan ?? currentTarget?.billet_target ?? 0,
      billet_actual: 0,
      next_product_plan: 0,
      next_billet_plan: 0,
      submit_status: 'not_started',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const buildMissingEntries = (reportId: string, sourceEntries: ProductionEntry[]) => {
    const existingEntries = get().entries.filter(entry => entry.report_id === reportId);
    const newEntries: ProductionEntry[] = [];

    EQUIPMENT_LIST.forEach(equipment => {
      SHIFT_LIST.forEach(shift => {
        const exists = existingEntries.some(entry => entry.equipment === equipment && entry.shift === shift);
        if (!exists) {
          newEntries.push(buildDefaultEntry(reportId, equipment, shift, sourceEntries));
        }
      });
    });

    return newEntries;
  };

  const initialTargets = normalizeTargetDefaults(getInitialArray(LOCAL_STATE?.targets, DEMO_TARGETS)).value;
  const initialPeriodTargets = normalizePeriodTargetDefaults(
    getInitialArray(LOCAL_STATE?.periodTargets, DEMO_PERIOD_TARGETS)
  ).value;
  const initialUsers = normalizeUserDefaults(getInitialArray(LOCAL_STATE?.users, DEMO_USERS)).value;

  return ({
  reports: normalizeReports(getInitialArray(LOCAL_STATE?.reports, DEMO_REPORTS)),
  entries: getInitialArray(LOCAL_STATE?.entries, DEMO_ENTRIES),
  targets: initialTargets,
  periodTargets: initialPeriodTargets,
  users: initialUsers,
  currentUserId: LOCAL_STATE?.currentUserId || 'user-admin',
  storageMode: getInitialStorageMode(),
  hasHydrated: false,
  isHydrating: false,
  syncError: undefined,
  lastSyncedAt: undefined,

  getReport: (reportDate) => {
    return get().reports.find(r => r.report_date === reportDate);
  },

  createReport: (reportDate, options) => {
    const existing = get().getReport(reportDate);
    const sourceReport = getSourceReport(reportDate, options);
    const sourceEntries = sourceReport ? get().getEntriesByReport(sourceReport.id) : [];

    if (existing) {
      const missingEntries = buildMissingEntries(existing.id, sourceEntries);
      if (missingEntries.length > 0) {
        set(state => ({
          entries: [...state.entries, ...missingEntries],
        }));
        persistCurrentState(true, () => upsertSupabaseRows('production_entries', missingEntries));
      }
      return existing;
    }

    const newReport: ProductionReport = {
      id: genId(),
      report_date: reportDate,
      next_plan_date: getPlanDateFromActualDate(reportDate),
      status: 'collecting',
      created_by: get().currentUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newEntries = buildMissingEntries(newReport.id, sourceEntries);

    set(state => ({
      reports: [...state.reports, newReport],
      entries: [...state.entries, ...newEntries],
    }));
    persistCurrentState(true, async () => {
      await upsertSupabaseRows('production_reports', newReport);
      await upsertSupabaseRows('production_entries', newEntries);
    });

    return newReport;
  },

  getEntriesByReport: (reportId) => {
    return get().entries.filter(e => e.report_id === reportId);
  },

  getEntryByUserEquipmentShift: (reportId, userId, equipment, shift) => {
    return get().entries.find(
      e => e.report_id === reportId && e.equipment === equipment && e.shift === shift
    );
  },

  saveEntry: (entryData) => {
    const existing = get().entries.find(
      e => e.report_id === entryData.report_id &&
        e.equipment === entryData.equipment &&
        e.shift === entryData.shift
    );

    const now = new Date().toISOString();

    let savedEntry: ProductionEntry;
    if (existing) {
      savedEntry = {
        ...existing,
        ...entryData,
        submit_status: existing.submit_status === 'submitted' || existing.submit_status === 'approved'
          ? existing.submit_status
          : 'saved',
        updated_at: now,
      };
      set(state => ({
        entries: state.entries.map(e =>
          e.id === existing.id ? savedEntry : e
        ),
      }));
    } else {
      const newEntry: ProductionEntry = {
        id: genId(),
        submit_status: 'saved',
        created_at: now,
        updated_at: now,
        product_plan: 0,
        product_actual: 0,
        billet_plan: 0,
        billet_actual: 0,
        next_product_plan: 0,
        next_billet_plan: 0,
        ...entryData,
      };
      savedEntry = newEntry;
      set(state => ({ entries: [...state.entries, newEntry] }));
    }
    persistCurrentState(true, () => upsertSupabaseRows('production_entries', savedEntry));
  },

  submitEntry: (entryId) => {
    let updatedEntry: ProductionEntry | undefined;
    set(state => ({
      entries: state.entries.map(e => {
        if (e.id !== entryId) return e;

        updatedEntry = {
          ...e,
          submit_status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return updatedEntry;
      }),
    }));
    persistCurrentState(
      true,
      updatedEntry ? () => upsertSupabaseRows('production_entries', updatedEntry) : undefined
    );
  },

  returnEntry: (entryId) => {
    let updatedEntry: ProductionEntry | undefined;
    set(state => ({
      entries: state.entries.map(e => {
        if (e.id !== entryId) return e;

        updatedEntry = {
          ...e,
          submit_status: 'returned',
          updated_at: new Date().toISOString(),
        };
        return updatedEntry;
      }),
    }));
    persistCurrentState(
      true,
      updatedEntry ? () => upsertSupabaseRows('production_entries', updatedEntry) : undefined
    );
  },

  approveEntry: (entryId) => {
    let updatedEntry: ProductionEntry | undefined;
    set(state => ({
      entries: state.entries.map(e => {
        if (e.id !== entryId) return e;

        updatedEntry = {
          ...e,
          submit_status: 'approved',
          updated_at: new Date().toISOString(),
        };
        return updatedEntry;
      }),
    }));
    persistCurrentState(
      true,
      updatedEntry ? () => upsertSupabaseRows('production_entries', updatedEntry) : undefined
    );
  },

  getTargets: () => get().targets,

  updateTarget: (equipment, shift, productTarget, billetTarget) => {
    let updatedTarget: EquipmentTarget | undefined;
    set(state => ({
      targets: state.targets.map(t => {
        if (t.equipment !== equipment || t.shift !== shift) return t;

        updatedTarget = { ...t, product_target: productTarget, billet_target: billetTarget };
        return updatedTarget;
      }),
    }));
    persistCurrentState(
      true,
      updatedTarget ? () => upsertSupabaseRows('equipment_targets', updatedTarget) : undefined
    );
  },

  getPeriodTargets: () => get().periodTargets,

  updatePeriodTarget: (period, productTarget, billetTarget) => {
    let updatedTarget: ProductionPeriodTarget | undefined;
    set(state => ({
      periodTargets: state.periodTargets.map(target => {
        if (target.period !== period) return target;

        updatedTarget = { ...target, product_target: productTarget, billet_target: billetTarget };
        return updatedTarget;
      }),
    }));
    persistCurrentState(
      true,
      updatedTarget ? () => upsertSupabaseRows('production_period_targets', updatedTarget) : undefined
    );
  },

  setCurrentUserId: (userId) => {
    set({ currentUserId: userId });
    persistCurrentState(false);
  },

  getCurrentUser: () => {
    const state = get();
    return state.users.find(user => user.id === state.currentUserId);
  },

  getUsers: () => get().users,

  updateUser: (userId, updates) => {
    let updatedUser: User | undefined;
    set(state => ({
      users: state.users.map((u): User => {
        if (u.id !== userId) return u;
        if (u.role === 'admin') {
          updatedUser = {
            ...u,
            ...updates,
            role: 'admin',
            can_write: true,
            can_edit: true,
            can_delete: true,
          };
          return updatedUser;
        }
        updatedUser = { ...u, ...updates };
        return updatedUser;
      }),
    }));
    persistCurrentState(
      true,
      updatedUser ? () => upsertSupabaseRows('users', updatedUser) : undefined
    );
  },

  addUser: (userData) => {
    const { role, can_write, can_edit, can_delete, ...rest } = userData;
    const newUser: User = {
      id: genId(),
      created_at: new Date().toISOString(),
      ...rest,
      role: role === 'admin' ? 'user' : role,
      can_write: can_write ?? false,
      can_edit: can_edit ?? false,
      can_delete: can_delete ?? false,
    };
    set(state => ({ users: [...state.users, newUser] }));
    persistCurrentState(true, () => upsertSupabaseRows('users', newUser));
  },

  deleteUser: (userId) => {
    const user = get().users.find(u => u.id === userId);
    if (!user || user.role === 'admin') return;

    set(state => ({
      users: state.users.filter(u => u.id !== userId),
      currentUserId: state.currentUserId === userId ? 'user-admin' : state.currentUserId,
    }));
    persistCurrentState(true, () => deleteSupabaseRows('users', userId));
  },

  hydrateStorage: async () => {
    if (get().isHydrating) return;

    const shouldUseLocalCache = !get().hasHydrated;
    const localState = shouldUseLocalCache ? loadLocalReportState() : null;
    if (localState) {
      set(state => {
        const normalizedUsers = normalizeUserDefaults(getInitialArray(localState.users, state.users));
        const normalizedTargets = normalizeTargetDefaults(getInitialArray(localState.targets, state.targets));
        const normalizedPeriodTargets = normalizePeriodTargetDefaults(
          getInitialArray(localState.periodTargets, state.periodTargets)
        );
        return {
          reports: normalizeReports(getInitialArray(localState.reports, state.reports)),
          entries: getInitialArray(localState.entries, state.entries),
          targets: normalizedTargets.value,
          periodTargets: normalizedPeriodTargets.value,
          users: normalizedUsers.value,
          currentUserId: resolveCurrentUserId(normalizedUsers.value, localState.currentUserId || state.currentUserId),
        };
      });
    }

    if (get().storageMode !== 'supabase') {
      set({ hasHydrated: true, isHydrating: false });
      saveLocalReportState(getPersistedState());
      return;
    }

    set({ isHydrating: true, syncError: undefined });
    try {
      await remoteWriteQueue.catch(() => undefined);
      const remoteState = await loadSupabaseReportState();
      const hasRemoteData = Boolean(
        remoteState.users?.length ||
        remoteState.reports?.length ||
        remoteState.entries?.length ||
        remoteState.targets?.length ||
        remoteState.periodTargets?.length
      );

      if (hasRemoteData) {
        let remoteDefaultsChanged = false;
        set(state => {
          const normalizedUsers = normalizeUserDefaults(getInitialArray(remoteState.users, state.users));
          const normalizedTargets = normalizeTargetDefaults(getInitialArray(remoteState.targets, state.targets));
          const normalizedPeriodTargets = normalizePeriodTargetDefaults(
            getInitialArray(remoteState.periodTargets, state.periodTargets)
          );
          remoteDefaultsChanged = normalizedUsers.changed || normalizedTargets.changed || normalizedPeriodTargets.changed;

          return {
            reports: normalizeReports(getInitialArray(remoteState.reports, state.reports)),
            entries: getInitialArray(remoteState.entries, state.entries),
            targets: normalizedTargets.value,
            periodTargets: normalizedPeriodTargets.value,
            users: normalizedUsers.value,
            currentUserId: resolveCurrentUserId(normalizedUsers.value, state.currentUserId),
          };
        });
        if (remoteDefaultsChanged) {
          await saveSupabaseReportState(getPersistedState());
        }
      } else {
        await saveSupabaseReportState(getPersistedState());
      }

      saveLocalReportState(getPersistedState());
      set({
        hasHydrated: true,
        isHydrating: false,
        lastSyncedAt: new Date().toISOString(),
        syncError: undefined,
      });
    } catch (error) {
      saveLocalReportState(getPersistedState());
      set({
        hasHydrated: true,
        isHydrating: false,
        syncError: getStorageErrorMessage(error),
      });
    }
  },
});
});
