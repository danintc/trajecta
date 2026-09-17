/**
 * Utilitário de Deduplication Hash para transações financeiras
 */

export function generateTransactionDedupHash(
  date: string,
  amountInCents: number,
  description: string
): string {
  const normalizedDesc = description.trim().toLowerCase().replace(/\s+/g, ' ');
  const raw = `${date}|${amountInCents}|${normalizedDesc}`;
  
  // Hash FNV-1a de 32-bit convertido para hexadecimal consistente
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
