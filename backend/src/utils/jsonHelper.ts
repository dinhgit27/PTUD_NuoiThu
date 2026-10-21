/**
 * Helpers to normalize JSON strings stored in SQL Server NVARCHAR(MAX)
 * so that API responses always deliver properly formatted JavaScript objects.
 */
export function safeJsonParse<T = any>(val: any, fallback: any = null): T {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val as unknown as T;
    }
  }
  return val as T;
}

export function formatPetType(petType: any) {
  if (!petType) return petType;
  return {
    ...petType,
    frameConfig: safeJsonParse(petType.frameConfig, {}),
    animations: safeJsonParse(petType.animations, {})
  };
}

export function formatItem(item: any) {
  if (!item) return item;
  return {
    ...item,
    frameConfig: item.frameConfig ? safeJsonParse(item.frameConfig, null) : null,
    animations: item.animations ? safeJsonParse(item.animations, null) : null,
    compatiblePetIds: item.compatiblePetIds ? safeJsonParse(item.compatiblePetIds, []) : [],
    petSheets: item.petSheets ? safeJsonParse(item.petSheets, {}) : {}
  };
}

export function formatUserPet(userPet: any) {
  if (!userPet) return userPet;
  return {
    ...userPet,
    petType: userPet.petType ? formatPetType(userPet.petType) : userPet.petType,
    userItems: Array.isArray(userPet.userItems)
      ? userPet.userItems.map((ui: any) => ({
          ...ui,
          item: ui.item ? formatItem(ui.item) : ui.item
        }))
      : userPet.userItems
  };
}
