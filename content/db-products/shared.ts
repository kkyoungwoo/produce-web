import type { ProductApiCredential } from "@/lib/i18n/types";

export const ACCOUNT_GUIDE_URL = "https://www.data.go.kr/iim/api/selectAPIAcountView.do";

export function serviceKeyCredential(dataId: string): ProductApiCredential {
  return {
    envVarName: `DATA_GO_KR_SERVICE_KEY_${dataId}`,
    queryKey: "serviceKey",
    placeholder: "YOUR_DATA_GO_KR_SERVICE_KEY",
  };
}