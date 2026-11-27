export const digitsOnly = (value?: string | null) => (value ?? '').replace(/\D/g, '');
export type PersonType = 'individual' | 'company';
export const getPersonType = (value?: string | null): PersonType | undefined => {
  const length = digitsOnly(value).length;
  return length === 11 ? 'individual' : length === 14 ? 'company' : undefined;
};

export function maskDocument(value: string, type: PersonType) {
  const digits = digitsOnly(value).slice(0, type === 'individual' ? 11 : 14);
  return type === 'individual'
    ? digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').replace(/^(\d{3})-(\d{1,2})$/, '$1$2')
    : digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2').replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2').replace(/(\/\d{4})(\d)/, '$1-$2');
}

export function maskPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length < 3) return digits;
  const local = digits.slice(2);
  const prefixLength = local.length === 9 ? 5 : 4;
  return '(' + digits.slice(0, 2) + ') ' + local.slice(0, prefixLength)
    + (local.length > prefixLength ? '-' + local.slice(prefixLength) : '');
}

export function validateClientContact(document: string, phone: string, type: PersonType): string | undefined {
  const doc = digitsOnly(document);
  const number = digitsOnly(phone);
  if (document && doc.length !== (type === 'individual' ? 11 : 14)) return 'Informe um CPF ou CNPJ com a quantidade correta de dígitos.';
  if (doc && /^([0-9])\1+$/.test(doc)) return 'Informe um CPF ou CNPJ válido.';
  if (phone && number.length !== 10 && number.length !== 11 && !/^55\d{10,11}$/.test(number)) return 'Informe um telefone com DDD.';
}

export function clientWhatsAppUrl(phone?: string | null): string | undefined {
  const digits = digitsOnly(phone);
  const international = /^55\d{10,11}$/.test(digits) ? digits : /^\d{10,11}$/.test(digits) ? '55' + digits : '';
  return international ? 'https://wa.me/' + international : undefined;
}
