export const hostCodeDigits = (value: string): string =>
  value.replace(/[^0-9]/g, "").slice(0, 8)
export const formatHostCode = (value: string): string => {
  const digits = hostCodeDigits(value)
  return digits.length > 4 ? digits.slice(0, 4) + "-" + digits.slice(4) : digits
}
export const isHostCodeComplete = (value: string): boolean =>
  /^[0-9]{8}$/.test(hostCodeDigits(value))
