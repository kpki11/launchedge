// src/utils/validators.ts

export function isRequired(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.trim());
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidCurrency(value: string): boolean {
  const n = parseFloat(value);
  return !isNaN(n) && n >= 0;
}

export function isValidDate(value: string): boolean {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    return !isNaN(date.getTime()) && date.getMonth() === m - 1;
  }
  return !isNaN(new Date(value).getTime());
}

export function validateRecord(
  data: Record<string, string>,
  fields: Array<{ name: string; isRequired: boolean; type: string }>
): Record<string, string> {
  const errors: Record<string, string> = {};
  fields.forEach(field => {
    const val = data[field.name];
    if (field.isRequired && !isRequired(val)) {
      errors[field.name] = `${field.name} is required`;
    } else if (val) {
      if (field.type === 'currency' && !isValidCurrency(val)) {
        errors[field.name] = 'Enter a valid amount';
      }
      if (field.type === 'date' && !isValidDate(val)) {
        errors[field.name] = 'Enter a valid date (DD/MM/YYYY)';
      }
    }
  });
  return errors;
}
