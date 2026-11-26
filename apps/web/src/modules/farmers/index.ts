export {
  farmerInputSchema,
  farmerSearchSchema,
  farmerSignupSchema,
  normalizeIndianMobile,
} from "./farmer.schema";
export {
  listSignupVillages,
  registerSelfAsFarmer,
  type FarmerSignupError,
  type FarmerSignupResult,
  type SignupVillage,
} from "./farmer-signup.service";
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
