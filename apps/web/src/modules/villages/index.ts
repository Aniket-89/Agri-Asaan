export {
  regionAssignmentSchema,
  regionInputSchema,
  villageAssignmentSchema,
  villageInputSchema,
  mitraInviteInputSchema,
  type MitraInviteInput,
} from "./territory.schema";
export { canViewTerritoryAdmin } from "./territory.permissions";
export {
  assignMitra,
  assignRegionalAdmin,
  createRegion,
  createVillage,
  getTerritoryOverview,
  removeMitra,
  removeRegionalAdmin,
  type TerritoryContext,
  type TerritoryErrorCode,
  type TerritoryOverview,
  type TerritoryRegion,
  type TerritoryResult,
} from "./territory.service";
