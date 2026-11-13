import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import MontserratRegular from '../../assets/fonts/Montserrat/Montserrat-Regular.ttf';
import i18n from '../../i18n';
import { sampleTransfer, sampleTransferText } from './transferLetterSample';
import MontserratSemiBold from '../../assets/fonts/Montserrat/Montserrat-SemiBold.ttf';
import MontserratSemiBoldItalic from '../../assets/fonts/Montserrat/Montserrat-SemiBoldItalic.ttf';
import MontserratLight from '../../assets/fonts/Montserrat/Montserrat-Light.ttf';

// Register fonts
Font.register({
  family: 'Montserrat-Regular',
  src: MontserratRegular,
});

Font.register({
  family: 'Montserrat-Light',
  src: MontserratLight,
});

Font.register({
  family: 'Montserrat-SemiBold',
  src: MontserratSemiBold,
});

Font.register({
  family: 'Montserrat-SemiBoldItalic',
  src: MontserratSemiBoldItalic,
});


const TransferLetterTemplate = ({ locale = 'en' }) => {
  const t = i18n.getFixedT(locale, 'common');
  const display = sampleTransferText(t, locale);
  return (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.date}>
        <Text>{display.date}</Text>
      </View>

      <View style={styles.address}>
        <Text style={styles.addressText}>{t('pdfTransfer_managingDirector')}</Text>
        <Text style={styles.addressText}>{sampleTransfer.bank}</Text>
        <Text style={styles.addressText}>{sampleTransfer.address[0]}</Text>
        <Text style={styles.addressText}>{sampleTransfer.address[1]}</Text>
      </View>

      <View style={styles.attention}>
        <Text>{display.attention}</Text>
      </View>

      <Text>{t('pdfTransfer_greeting')}</Text>

      <View style={styles.subject}>
        <Text>{display.subject}</Text>
      </View>

      <Text>{t('pdfTransfer_instruction')}</Text>

      <View style={{ marginTop: 10 }}>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>{t('pdfTransfer_beneficiary')}</Text>
          <Text style={styles.tableValue}>{sampleTransfer.beneficiary}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>{t('pdfTransfer_bank')}</Text>
          <Text style={styles.tableValue}>{sampleTransfer.beneficiaryBank}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>{t('pdfTransfer_iban')}</Text>
          <Text style={styles.tableValue}>{sampleTransfer.iban}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>{t('pdfTransfer_swift')}</Text>
          <Text style={styles.tableValue}>{sampleTransfer.swift}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>{t('pdfTransfer_amount')}</Text>
          <Text style={styles.tableValue}>{display.amount}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>{t('pdfTransfer_reference')}</Text>
          <Text style={styles.tableValue}>{display.reference}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>{t('pdfTransfer_purpose')}</Text>
          <Text style={styles.tableValue}>{t('pdfTransfer_purposeText')}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text>{t('pdfTransfer_debitInstruction')}</Text>
        <Text style={{ marginTop: 20 }}>{t('pdfTransfer_thanks')}</Text>
        <Text style={{ marginTop: 10 }}>{t('pdfTransfer_closing')}</Text>
      </View>

      <View style={styles.signatures}>
        <View>
          <View style={styles.signatureLine} />
          <Text>{t('pdfTransfer_signatory')}</Text>
        </View>
        <View>
          <View style={styles.signatureLine} />
          <Text>{t('pdfTransfer_signatory')}</Text>
        </View>
      </View>
    </Page>
  </Document>
  );
};

export default TransferLetterTemplate;


// PDF styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Montserrat-Regular',
    fontSize: '10px'
  },
  date: {
    textAlign: 'right',
    marginBottom: 20,
  },
  address: {
    marginBottom: 20,
  },
  addressText: {
    fontFamily: 'Montserrat-Regular',
    fontSize: '10px',
    marginBottom: '10px'
  },
  attention: {
    marginBottom: 10,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: '10px',
    textDecoration: 'underline'
  },
  subject: {
    marginTop: 20,
    marginBottom: 20,
    fontFamily: 'Montserrat-SemiBoldItalic',
    fontSize: '10px',
    textDecoration: 'underline'
  },
  tableRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: '10px'
  },
  tableLabel: {
    width: 80,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: '10px'
  },
  tableValue: {
    flex: 1,
  },
  footer: {
    marginTop: 40,
  },
  signatures: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureLine: {
    borderTop: '1px solid black',
    width: 200,
    marginTop: 40,
  }
});