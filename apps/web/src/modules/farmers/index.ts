export {
  farmerInputSchema,
  farmerPlacementSchema,
  farmerSearchSchema,
  farmerSignupSchema,
  normalizeIndianMobile,
} from "./farmer.schema";
export {
  getSignupOptions,
  registerSelfAsFarmer,
  type FarmerSignupError,
  type FarmerSignupResult,
  type SignupVillage,
} from "./farmer-signup.service";
export { canPlaceFarmers, canWorkWithFarmers } from "./farmer.permissions";
export {
  getFarmer,
  listFarmers,
  listPlacementVillages,
  listRegistrationVillages,
  placeFarmer,
  registerFarmer,
  type FarmerContext,
  type FarmerDetail,
  type FarmerListItem,
  type PlaceFarmerResult,
  type RegisterFarmerResult,
  type VillageOption,
} from "./farmer.service";
