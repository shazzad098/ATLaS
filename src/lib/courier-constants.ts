export const COURIER_PROVIDERS = [
  {
    id: "steadfast",
    name: "Steadfast Courier",
    banglaName: "স্টেডফাস্ট কুরিয়ার",
    defaultUrl: "https://portal.steadfast.com.bd/api/v1",
    description: "বাংলাদেশের সবচেয়ে জনপ্রিয় ই-কমার্স ক্যাশ অন ডেলিভারি কুরিয়ার।",
  },
  {
    id: "pathao",
    name: "Pathao Courier",
    banglaName: "পাঠাও কুরিয়ার",
    defaultUrl: "https://api-hermes.pathao.com",
    description: "ঢাকা ও সারাদেশব্যাপী দ্রুত পার্সেল ডেলিভারি ও রিয়েলটাইম ট্র্যাকিং।",
  },
  {
    id: "redx",
    name: "RedX Delivery",
    banglaName: "রেডএক্স ডেলিভারি",
    defaultUrl: "https://openapi.redx.com.bd/v1.0.0-beta",
    description: "ডোরস্টেপ পিকআপ ও বিস্তৃত ডেলিভারি নেটওয়ার্ক।",
  },
  {
    id: "paperfly",
    name: "Paperfly",
    banglaName: "পেপারফ্লাই",
    defaultUrl: "https://api.paperfly.com.bd",
    description: "স্মার্ট লজিস্টিকস ও অল-বাংলাদেশ ডেলিভারি কভারেজ।",
  },
  {
    id: "sandbox",
    name: "Sandbox Simulation",
    banglaName: "স্যান্ডবক্স মোড (টেস্টিং)",
    defaultUrl: "https://sandbox.courier.local",
    description: "লাইভ অ্যাকাউন্ট ছাড়াই সম্পূর্ণ কুরিয়ার বুকিং ও ট্র্যাকিং ফ্লো টেস্ট করুন।",
  },
] as const;

export type CourierProviderId = (typeof COURIER_PROVIDERS)[number]["id"];

export type StoreCourierPublicConfig = {
  provider: string;
  isEnabled: boolean;
  apiUrl: string;
  hasApiKey: boolean;
  hasSecretKey: boolean;
  storeIdAtCourier: string;
  webhookSecret: string;
  autoBooking: boolean;
  webhookUrl: string;
};
