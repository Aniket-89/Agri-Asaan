export {
  regionAssignmentSchema,
  regionInputSchema,
  villageAssignmentSchema,
  villageInputSchema,
  mitraInviteInputSchema,
  type MitraInviteInput,
  regionalAdminInviteInputSchema,
  regionPincodeSchema,
  type RegionalAdminInviteInput,
} from "./territory.schema";
export { canViewTerritoryAdmin } from "./territory.permissions";
export {
  assignMitra,
  addRegionPincode,
  assignRegionalAdmin,
  createRegion,
  createVillage,
  getTerritoryOverview,
  removeMitra,
  removeRegionPincode,
  removeRegionalAdmin,
  type TerritoryContext,
  type TerritoryErrorCode,
  type TerritoryOverview,
  type TerritoryRegion,
  type TerritoryResult,
} from "./territory.service";
