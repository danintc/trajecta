import { z } from 'zod';

export const CreateTransactionSchema = z.object({
  type: z.enum(['expense', 'income', 'investment_deposit', 'dividend']),
  description: z.string().trim().min(1, 'Descrição é obrigatória').max(100),
  amountInCents: z.number().int('Valor deve ser em centavos inteiros').positive('O valor deve ser positivo'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  accountOrCard: z.string().trim().min(1, 'Conta ou Cartão é obrigatório'),
  notes: z.string().max(500).optional(),
  
  // Parcelamento nativo
  isInstallment: z.boolean().default(false),
  installmentTotal: z.number().int().min(2, 'Mínimo de 2 parcelas').max(96, 'Máximo de 96 parcelas').optional(),
}).refine((data) => {
  if (data.isInstallment && !data.installmentTotal) {
    return false;
  }
  return true;
}, {
  message: 'Para compras parceladas, informe a quantidade de parcelas (entre 2 e 96)',
  path: ['installmentTotal'],
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
