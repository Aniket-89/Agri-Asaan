export { farmerInputSchema, farmerSearchSchema, normalizeIndianMobile } from "./farmer.schema";
export { canWorkWithFarmers } from "./farmer.permissions";
export {
  getFarmer,
  listFarmers,
  listRegistrationVillages,
  registerFarmer,
  type FarmerContext,
  type FarmerDetail,
  type FarmerListItem,
  type RegisterFarmerResult,
  type VillageOption,
} from "./farmer.service";
