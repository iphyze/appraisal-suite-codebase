/** Demonstration letter content shared by its PDF and its on-screen preview. */
import { pdfLongDate, pdfMoney } from './pdfLocale.js';

export const sampleTransfer = Object.freeze({
  date: '2025-05-12T12:00:00',
  bank: 'Guaranty Trust Bank Plc',
  address: ['635, Akin Adesola Street', 'Victoria Island, Lagos.'],
  attention: 'John Doe',
  account: '123456789',
  beneficiary: 'Sant Marino Company',
  beneficiaryBank: 'Danske Bank',
  iban: 'DK083145454556682',
  swift: 'BABAKE',
  amount: 12280.14,
  reference: 'LEM/PO/2025/03045',
  quote: '18647vl',
});

export function sampleTransferText(t, locale = 'en') {
  return {
    date: pdfLongDate(sampleTransfer.date, locale),
    attention: t('pdfTransfer_attention', { name: sampleTransfer.attention }),
    subject: t('pdfTransfer_subject', { account: sampleTransfer.account }),
    amount: `${pdfMoney(sampleTransfer.amount, 'EUR', locale)} /- ${t('pdfTransfer_amountInWords')}`,
    reference: t('pdfTransfer_orderReference', { reference: sampleTransfer.reference, quote: sampleTransfer.quote }),
  };
}
