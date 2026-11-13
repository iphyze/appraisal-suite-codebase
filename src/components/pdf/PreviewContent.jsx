import React from 'react';
import i18n from '../../i18n';
import { previewStyles } from './previewStyles';
import { sampleTransfer, sampleTransferText } from './transferLetterSample';

const PreviewContent = ({ locale = 'en' }) => {
  const t = i18n.getFixedT(locale, 'common');
  const display = sampleTransferText(t, locale);
  return (
    <div style={previewStyles.container}>
      <p style={{ textAlign: 'right' }}>{display.date}</p>
      <p>
        {t('pdfTransfer_managingDirector')}<br />
        {sampleTransfer.bank}<br />
        {sampleTransfer.address[0]}<br />
        {sampleTransfer.address[1]}
      </p>
      <p><strong>{display.attention}</strong></p>
      <p>{t('pdfTransfer_greeting')}</p>
      <p><strong>{display.subject}</strong></p>
      <p>{t('pdfTransfer_instruction')}</p>
      <table style={previewStyles.table}>
        <tbody>
          <tr><td><strong>{t('pdfTransfer_beneficiary')}</strong></td><td>{sampleTransfer.beneficiary}</td></tr>
          <tr><td><strong>{t('pdfTransfer_bank')}</strong></td><td>{sampleTransfer.beneficiaryBank}</td></tr>
          <tr><td><strong>{t('pdfTransfer_iban')}</strong></td><td>{sampleTransfer.iban}</td></tr>
          <tr><td><strong>{t('pdfTransfer_swift')}</strong></td><td>{sampleTransfer.swift}</td></tr>
          <tr><td><strong>{t('pdfTransfer_amount')}</strong></td><td>{display.amount}</td></tr>
          <tr><td><strong>{t('pdfTransfer_reference')}</strong></td><td>{display.reference}</td></tr>
          <tr><td><strong>{t('pdfTransfer_purpose')}</strong></td><td>{t('pdfTransfer_purposeText')}</td></tr>
        </tbody>
      </table>
      <p style={{ marginTop: '20px' }}>{t('pdfTransfer_debitInstruction')}</p>
      <p>{t('pdfTransfer_thanks')}</p>
      <p>{t('pdfTransfer_closing')}</p>
      <p style={{ marginTop: '40px' }}>
        {t('pdfTransfer_forCompany')}<br /><br />
        ___________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        ___________________________<br />
        {t('pdfTransfer_signatory')} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        {t('pdfTransfer_signatory')}
      </p>
    </div>
  );
};

export default PreviewContent;
