export const DEFAULT_COMPANY_ID = "nkolosov"

export const companyDisplayName = (company: string): string =>
  company === DEFAULT_COMPANY_ID ? "NKolosov" : company
