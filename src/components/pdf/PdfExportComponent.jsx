import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { PDFDownloadLink } from '@react-pdf/renderer';
import TransferLetterTemplate from './TransferLetterTemplate';
import PreviewContent from './PreviewContent';
import { previewStyles } from './previewStyles';

const PdfExportComponent = () => {
  const { t } = useTranslation('common');
  const locale = i18n.language === 'fr' ? 'fr' : 'en';
  return (
    <>
      <div style={previewStyles.exportButton}>
        <PDFDownloadLink
          key={`transfer-pdf-${locale}`}
          document={<TransferLetterTemplate locale={locale} />}
          fileName={locale === 'fr' ? 'lettre-de-virement.pdf' : 'transfer-letter.pdf'}
          style={previewStyles.button}
        >
          {({ loading }) => (loading ? t('pdfTransfer_generating') : t('pdfTransfer_export'))}
        </PDFDownloadLink>
      </div>
      <PreviewContent locale={locale} />
    </>
  );
};

export default PdfExportComponent;