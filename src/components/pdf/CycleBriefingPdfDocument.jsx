import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT_FAMILY } from './registerMontserratFonts';
import i18n from '../../i18n';
import { pdfNumber, pdfPercentPoints, pdfScore } from './pdfLocale';

const colors = {
  navy: '#14263D',
  navySoft: '#223852',
  green: '#318C4B',
  greenLight: '#EAF5EE',
  amber: '#AA7325',
  amberLight: '#FFF5E7',
  blue: '#386A9B',
  blueLight: '#EDF4FB',
  background: '#FFFFFF',
  surface: '#F5F7FA',
  border: '#E3E8EF',
  text: '#26374B',
  muted: '#67788B',
};

const s = StyleSheet.create({
  page: {
    paddingTop: 39,
    paddingHorizontal: 42,
    paddingBottom: 48,
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
  },
  masthead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandIcon: { width: 33, height: 33, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brandInitial: { color: '#FFFFFF', fontSize: 17, fontWeight: 600 },
  brandCopy: { marginLeft: 10 },
  brandTitle: { fontSize: 13, fontWeight: 600, color: colors.navy },
  brandTagline: { marginTop: 2, fontSize: 6.4, color: colors.muted, letterSpacing: 1.15 },
  issueTag: { color: colors.green, fontSize: 7.1, fontWeight: 600, letterSpacing: 1.0 },
  topRule: { height: 3, backgroundColor: colors.navy, borderRadius: 2, marginBottom: 21 },
  sectionEyebrow: { fontSize: 7.2, color: colors.green, fontWeight: 600, letterSpacing: 1.2 },
  title: { marginTop: 6, color: colors.navy, fontSize: 23, fontWeight: 600, lineHeight: 1.15 },
  subtitle: { marginTop: 7, color: colors.muted, fontSize: 9.2, lineHeight: 1.45 },
  metrics: { flexDirection: 'row', marginTop: 19, marginBottom: 21, marginHorizontal: -4 },
  metricBox: { width: '25%', paddingHorizontal: 4 },
  metric: { padding: 10, minHeight: 85, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10 },
  metricLabel: { fontSize: 7.1, color: colors.muted, lineHeight: 1.3 },
  metricValue: { marginTop: 8, fontSize: 17, fontWeight: 600, color: colors.navy },
  metricHint: { fontSize: 6.4, color: colors.muted, marginTop: 4 },
  sectionDivider: { height: 1, backgroundColor: colors.border, marginBottom: 16 },
  narrativeLabel: { fontSize: 7.2, color: colors.green, fontWeight: 600, letterSpacing: 1.1 },
  narrativeHeading: { marginTop: 7, fontSize: 13.2, lineHeight: 1.4, fontWeight: 600, color: colors.navy },
  narrativeText: { marginTop: 9, fontSize: 9, lineHeight: 1.55, color: colors.text },
  insightRow: { flexDirection: 'row', marginTop: 21, marginHorizontal: -5 },
  insightColumn: { width: '50%', paddingHorizontal: 5 },
  insightCard: { borderRadius: 10, borderWidth: 1, padding: 13, minHeight: 120 },
  highlightCard: { borderColor: '#D4EBDD', backgroundColor: colors.greenLight },
  riskCard: { borderColor: '#F1E0CA', backgroundColor: colors.amberLight },
  sectionHeading: { fontSize: 10, fontWeight: 600, color: colors.navy, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet: { width: 4, height: 4, borderRadius: 2, marginTop: 5, marginRight: 8, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 8.1, lineHeight: 1.48 },
  actionsCard: { backgroundColor: colors.blueLight, borderColor: '#D8E6F5', borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 11 },
  actionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  actionLabel: { color: colors.blue, fontSize: 7.2, fontWeight: 600, letterSpacing: 0.8 },
  actionTitle: { color: colors.navy, fontSize: 10.5, fontWeight: 600, marginBottom: 10 },
  footer: {
    position: 'absolute', bottom: 23, left: 42, right: 42,
    paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  footerText: { fontSize: 6.6, color: colors.muted },
  footPage: { fontSize: 6.6, color: colors.muted },
});

const readable = (value, fallback = '—') =>
  value === null || value === undefined || String(value).trim() === '' ? fallback : String(value);

const items = (values) => (Array.isArray(values) ? values.filter((value) => String(value || '').trim()) : []);

function Bullets({ values, color, t }) {
  const list = items(values);
  if (!list.length) return <Text style={s.bulletText}>{t('pdf_noItems')}</Text>;
  return list.map((value, index) => (
    <View key={index} style={s.bulletRow}>
      <View style={[s.bullet, { backgroundColor: color }]} />
      <Text style={s.bulletText}>{String(value)}</Text>
    </View>
  ));
}

function Metric({ label, value, hint }) {
  return (
    <View style={s.metricBox}>
      <View style={s.metric}>
        <Text style={s.metricLabel}>{label}</Text>
        <Text style={s.metricValue}>{readable(value)}</Text>
        {hint ? <Text style={s.metricHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

/** Export the same scoped briefing already displayed on Analytics; no new AI request. */
export default function CycleBriefingPdfDocument({ facts, briefing, locale = 'en' }) {
  const t = i18n.getFixedT(locale, 'analytics');
  const f = facts || {};
  const b = briefing || {};
  const outstanding = f.rating_spread_vs_guideline?.[0];

  return (
    <Document title={t('pdf_documentTitle', { cycle: readable(f.cycle, t('pdf_fallbackCycle')) })} author="AppraisalSuite" subject={t('pdf_subject')}>
      <Page size="A4" style={s.page} wrap>
        <View style={s.masthead}>
          <View style={s.brand}>
            <View style={s.brandIcon}><Text style={s.brandInitial}>A</Text></View>
            <View style={s.brandCopy}>
              <Text style={s.brandTitle}>AppraisalSuite</Text>
              <Text style={s.brandTagline}>{t('pdf_brandTagline')}</Text>
            </View>
          </View>
          <Text style={s.issueTag}>{t('pdf_issueTag')}</Text>
        </View>
        <View style={s.topRule} />

        <View>
          <Text style={s.sectionEyebrow}>{t('pdf_eyebrow')}</Text>
          <Text style={s.title}>{t('pdf_title')}</Text>
          <Text style={s.subtitle}>{readable(f.cycle, t('pdf_fallbackCycle'))}  |  {t('pdf_overview')}</Text>
        </View>

        <View style={s.metrics}>
          <Metric label={t('pdf_appraisals')} value={pdfNumber(f.appraisals?.appraisals ?? 0, locale)} />
          <Metric label={t('pdf_averageScore')} value={pdfScore(f.appraisals?.average_score, locale)} hint={t('pdf_outOf', { max: pdfScore(5, locale) })} />
          <Metric label={t('pdf_outstanding')} value={outstanding ? pdfPercentPoints(outstanding.share_percent, locale) : '—'} hint={t('pdf_guideline')} />
          <Metric label={t('pdf_acknowledged')} value={pdfPercentPoints(f.progress?.percent_acknowledged ?? 0, locale)} />
        </View>

        <View style={s.sectionDivider} />
        <View>
          <Text style={s.narrativeLabel}>{t('pdf_executiveSummary')}</Text>
          <Text style={s.narrativeHeading}>{readable(b.headline, t('pdf_fallbackHeadline'))}</Text>
          <Text style={s.narrativeText}>{readable(b.summary, t('pdf_fallbackSummary'))}</Text>
        </View>

        <View style={s.insightRow}>
          <View style={s.insightColumn}>
            <View style={[s.insightCard, s.highlightCard]}>
              <Text style={s.sectionHeading}>{t('pdf_performanceHighlights')}</Text>
              <Bullets values={b.highlights} color={colors.green} t={t} />
            </View>
          </View>
          <View style={s.insightColumn}>
            <View style={[s.insightCard, s.riskCard]}>
              <Text style={s.sectionHeading}>{t('pdf_risks')}</Text>
              <Bullets values={b.risks} color={colors.amber} t={t} />
            </View>
          </View>
        </View>

        <View style={s.actionsCard}>
          <View style={s.actionHeader}><Text style={s.actionLabel}>{t('pdf_nextSteps')}</Text></View>
          <Text style={s.actionTitle}>{t('pdf_recommendedActions')}</Text>
          <Bullets values={b.actions} color={colors.blue} t={t} />
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{t('pdf_footer')}</Text>
          <Text style={s.footPage} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
