import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';

/**
 * Normalize phone number to E.164 format
 * Examples:
 *   +971501234567 -> +971501234567
 *   00971501234567 -> +971501234567
 *   971501234567 -> +971501234567
 *   0501234567 (UAE context) -> +971501234567
 */
export function normalizePhoneKey(phone: string, defaultCountry: CountryCode = 'AE'): string {
  if (!phone) return '';
  
  // Clean the input
  let cleaned = phone.trim();
  
  // Replace leading 00 with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  
  // If doesn't start with +, try to add it
  if (!cleaned.startsWith('+')) {
    // If starts with country code without +
    if (cleaned.match(/^(971|966|965|973|968|974)/)) {
      cleaned = '+' + cleaned;
    }
  }
  
  try {
    const parsed = parsePhoneNumber(cleaned, defaultCountry);
    if (parsed && parsed.isValid()) {
      return parsed.format('E.164');
    }
  } catch (error) {
    // Parsing failed, return cleaned version
  }
  
  // Fallback: return cleaned version with + prefix if missing
  if (!cleaned.startsWith('+') && cleaned.length >= 10) {
    // Assume UAE if no country code
    return '+971' + cleaned.replace(/^0+/, '');
  }
  
  return cleaned;
}

/**
 * Validate phone number
 */
export function isValidPhone(phone: string, defaultCountry: CountryCode = 'AE'): boolean {
  try {
    return isValidPhoneNumber(phone, defaultCountry);
  } catch {
    return false;
  }
}

/**
 * Extract country from phone number
 */
export function getCountryFromPhone(phone: string): string | undefined {
  try {
    const parsed = parsePhoneNumber(phone);
    if (parsed) {
      return parsed.country;
    }
  } catch {
    // Fallback: detect by prefix
    const prefixMap: Record<string, string> = {
      '+971': 'UAE',
      '+966': 'KSA',
      '+965': 'KWT',
      '+973': 'BHR',
      '+968': 'OMN',
      '+974': 'QAT',
    };
    
    for (const [prefix, country] of Object.entries(prefixMap)) {
      if (phone.startsWith(prefix)) {
        return country;
      }
    }
  }
  
  return undefined;
}

/**
 * Format phone for display
 */
export function formatPhoneDisplay(phone: string): string {
  try {
    const parsed = parsePhoneNumber(phone);
    if (parsed) {
      return parsed.formatInternational();
    }
  } catch {
    // Return as-is
  }
  return phone;
}
