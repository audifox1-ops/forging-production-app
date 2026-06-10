import { EQUIPMENT_LIST, Equipment, ProductionEntry } from '../types';

export interface EquipmentReasonGroup {
  equipment: Equipment;
  categories: string[];
  reasonDetails: string[];
  actionsToday: string[];
  recoveryPlans: string[];
  supportRequests: string[];
  entries: ProductionEntry[];
}

function addUnique(items: string[], value?: string | null) {
  const trimmed = value?.trim();
  if (trimmed && !items.includes(trimmed)) items.push(trimmed);
}

function hasReasonContent(entry: ProductionEntry) {
  return Boolean(
    entry.reason_category ||
    entry.reason_detail?.trim() ||
    entry.action_today?.trim() ||
    entry.recovery_plan?.trim() ||
    entry.support_request?.trim()
  );
}

export function getEquipmentReasonGroups(entries: ProductionEntry[]): EquipmentReasonGroup[] {
  const groupMap = new Map<Equipment, EquipmentReasonGroup>();

  entries
    .filter(hasReasonContent)
    .forEach(entry => {
      const group = groupMap.get(entry.equipment) ?? {
        equipment: entry.equipment,
        categories: [],
        reasonDetails: [],
        actionsToday: [],
        recoveryPlans: [],
        supportRequests: [],
        entries: [],
      };

      addUnique(group.categories, entry.reason_category);
      addUnique(group.reasonDetails, entry.reason_detail);
      addUnique(group.actionsToday, entry.action_today);
      addUnique(group.recoveryPlans, entry.recovery_plan);
      addUnique(group.supportRequests, entry.support_request);
      group.entries.push(entry);
      groupMap.set(entry.equipment, group);
    });

  return Array.from(groupMap.values()).sort(
    (a, b) => EQUIPMENT_LIST.indexOf(a.equipment) - EQUIPMENT_LIST.indexOf(b.equipment)
  );
}

