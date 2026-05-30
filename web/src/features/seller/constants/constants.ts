// ============================================================================
// constants.ts — Form default values + static enums for seller onboarding
// ============================================================================

import type { AccountFormValues } from "../validators/account";
import type { ShopFormValues } from "../validators/shop";
import type { BankDirectFormValues } from "../validators/bank";
import { DEFAULT_COUNTRY_CODE } from "./countries";

// OTP resend cooldown in seconds — matches industry standard (Twilio default).
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

// Shop category list — keep in sync with admin's product category taxonomy.
export const SHOP_CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Books",
  "Sports & Outdoors",
  "Toys & Games",
  "Grocery",
  "Health & Wellness",
  "Automotive",
  "Other",
] as const;

export const accountDefaultValues: AccountFormValues = {
  name: "",
  email: "",
  phone: "",
  country: DEFAULT_COUNTRY_CODE,
  password: "",
};

export const shopDefaultValues: ShopFormValues = {
  shopName: "",
  category: "",
  description: "",
  address: "",
  website: "",
  gstNumber: "",
  panNumber: "",
};

export const bankDirectDefaultValues: BankDirectFormValues = {
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfscCode: "",
};
