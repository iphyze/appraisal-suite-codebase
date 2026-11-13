import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT_FAMILY } from './registerMontserratFonts';
import i18n from '../../i18n';
import { pdfDate, pdfPercentPoints, pdfScore } from './pdfLocale';

const palette = {
  green: '#2f9a4a',
  greenDark: '#226f37',
  greenSoft: '#eef8f0',
  greenLine: '#cfe8d5',
  ink: '#122033',
  text: '#263548',
  muted: '#6b7788',
  line: '#dde4ea',
  soft: '#f6f8fa',
  white: '#ffffff',
  amber: '#a9640a',
  amberSoft: '#fff6e9',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 92,
    paddingRight: 34,
    paddingBottom: 50,
    paddingLeft: 34,
    fontSize: 9.2,
    fontFamily: PDF_FONT_FAMILY,
    color: palette.text,
    backgroundColor: palette.white,
  },
  fixedHeader: {
    position: 'absolute',
    top: 24,
    left: 34,
    right: 34,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    paddingBottom: 12,
  },
  brandWrap: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  brandMark: {
    width: 31,
    height: 31,
    borderRadius: 8,
    backgroundColor: palette.green,
    color: palette.white,
    fontSize: 15,
    fontWeight: 600,
    textAlign: 'center',
    paddingTop: 7,
    marginRight: 9,
  },
  brandName: { color: palette.ink, fontSize: 14, fontWeight: 600 },
  brandSub: { color: palette.muted, fontSize: 6.8, marginTop: 2, letterSpacing: 1.2 },
  docMeta: { alignItems: 'flex-end', flexShrink: 1, maxWidth: 230 },
  docMetaTitle: { color: palette.greenDark, fontSize: 8.5, fontWeight: 600 },
  docMetaLine: { color: palette.muted, fontSize: 6.8, marginTop: 3, textAlign: 'right' },
  fixedFooter: {
    position: 'absolute',
    left: 34,
    right: 34,
    bottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 8,
    color: palette.muted,
    fontSize: 6.8,
  },

  hero: {
    borderRadius: 14,
    backgroundColor: palette.greenSoft,
    borderWidth: 1,
    borderColor: palette.greenLine,
    padding: 18,
    marginBottom: 16,
  },
  eyebrow: { color: palette.greenDark, fontSize: 7, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase' },
  heroTitle: { color: palette.ink, fontSize: 20, fontWeight: 600, marginTop: 6 },
  heroSub: { color: palette.muted, fontSize: 9, marginTop: 5, lineHeight: 1.4 },
  heroScoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13 },
  scorePill: { backgroundColor: palette.green, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginRight: 9 },
  scorePillValue: { color: palette.white, fontSize: 16, fontWeight: 600 },
  scorePillLabel: { color: '#e8f7ec', fontSize: 6.4, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.7 },
  statementPill: { backgroundColor: palette.white, borderRadius: 9, borderWidth: 1, borderColor: palette.greenLine, paddingVertical: 8, paddingHorizontal: 11, flexShrink: 1 },
  statementText: { color: palette.greenDark, fontSize: 9, fontWeight: 600 },

  sectionHeadingWrap: { marginTop: 12, marginBottom: 9 },
  sectionKicker: { color: palette.green, fontSize: 6.8, fontWeight: 600, letterSpacing: 1.0, textTransform: 'uppercase' },
  sectionHeading: { color: palette.ink, fontSize: 12.5, fontWeight: 600, marginTop: 3 },
  sectionDescription: { color: palette.muted, fontSize: 8, marginTop: 3, lineHeight: 1.45 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -5, marginRight: -5 },
  infoCard: { width: '50%', padding: 5 },
  infoCardInner: { backgroundColor: palette.soft, borderWidth: 1, borderColor: palette.line, borderRadius: 9, padding: 10, minHeight: 47 },
  infoLabel: { color: palette.muted, fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 0.7 },
  infoValue: { color: palette.ink, fontSize: 9, fontWeight: 600, marginTop: 4 },

  bandGrid: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -4, marginRight: -4 },
  bandCard: { width: '20%', padding: 4 },
  bandCardInner: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 8, minHeight: 54, backgroundColor: palette.soft },
  bandLabel: { color: palette.ink, fontSize: 7.2, fontWeight: 600, lineHeight: 1.25 },
  bandRange: { color: palette.greenDark, fontSize: 7.3, fontWeight: 600, marginTop: 5 },

  scoringBlock: { marginBottom: 18 },
  table: { borderWidth: 1, borderColor: palette.line, borderRadius: 9 },
  tableHeader: { flexDirection: 'row', backgroundColor: palette.soft, borderBottomWidth: 1, borderBottomColor: palette.line, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  tableHeaderText: { color: palette.muted, fontSize: 6.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.line },
  tableRowLast: { flexDirection: 'row' },
  tableCellMain: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
  tableCellRight: { width: 84, paddingVertical: 8, paddingHorizontal: 10, textAlign: 'right' },
  tableMainText: { color: palette.ink, fontSize: 8.3, fontWeight: 600 },
  tableSubText: { color: palette.muted, fontSize: 6.8, marginTop: 2 },
  tableValue: { color: palette.greenDark, fontSize: 8.4, fontWeight: 600 },

  sectionCard: { marginBottom: 16 },
  sectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    backgroundColor: palette.greenSoft,
    borderWidth: 1,
    borderColor: palette.greenLine,
    padding: 11,
    marginBottom: 8,
  },
  sectionBarLeft: { flex: 1, paddingRight: 10 },
  sectionCode: { color: palette.green, fontSize: 6.6, fontWeight: 600, letterSpacing: 0.9, textTransform: 'uppercase' },
  sectionName: { color: palette.ink, fontSize: 11.2, fontWeight: 600, marginTop: 2 },
  sectionMode: { color: palette.muted, fontSize: 6.7, marginTop: 2 },
  sectionRating: { alignItems: 'flex-end' },
  sectionRatingValue: { color: palette.greenDark, fontSize: 13, fontWeight: 600 },
  sectionRatingLabel: { color: palette.muted, fontSize: 6.3, marginTop: 2, textTransform: 'uppercase' },

  responseCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 9,
    padding: 10,
    marginBottom: 7,
    backgroundColor: palette.white,
  },
  responseTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  responseIndex: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: palette.greenSoft,
    color: palette.greenDark,
    fontSize: 7.5,
    fontWeight: 600,
    textAlign: 'center',
    paddingTop: 6,
    marginRight: 7,
  },
  responseQuestionWrap: { flex: 1, paddingRight: 8 },
  responseQuestion: { color: palette.ink, fontSize: 8.4, fontWeight: 600, lineHeight: 1.35 },
  responseWeight: { color: palette.muted, fontSize: 6.4, marginTop: 3 },
  ratingBadge: { width: 46, borderRadius: 8, backgroundColor: palette.green, paddingVertical: 6, alignItems: 'center' },
  ratingBadgeValue: { color: palette.white, fontSize: 10, fontWeight: 600 },
  ratingBadgeLabel: { color: '#eaf7ed', fontSize: 5.6, marginTop: 2, textTransform: 'uppercase' },
  detailRow: { flexDirection: 'row', marginTop: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: palette.line },
  detailCol: { flex: 1, paddingRight: 8 },
  detailLabel: { color: palette.muted, fontSize: 6.2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.45 },
  detailText: { color: palette.text, fontSize: 7.5, marginTop: 3, lineHeight: 1.35 },
  overallNote: { marginTop: 7, borderRadius: 8, padding: 8, backgroundColor: palette.soft, borderWidth: 1, borderColor: palette.line },

  recommendationGrid: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -5, marginRight: -5 },
  recommendationCard: { width: '50%', padding: 5 },
  recommendationInner: { borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 11, minHeight: 80, backgroundColor: palette.soft },
  recommendationInnerWide: { borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 11, minHeight: 80, backgroundColor: palette.soft },
  recommendationLabel: { color: palette.greenDark, fontSize: 6.6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 },
  recommendationText: { color: palette.ink, fontSize: 8.8, marginTop: 6, lineHeight: 1.45 },

  acknowledgementBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, backgroundColor: palette.greenSoft, borderWidth: 1, borderColor: palette.greenLine, padding: 11, marginBottom: 10 },
  acknowledgementDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.green, marginRight: 8 },
  acknowledgementTitle: { color: palette.ink, fontSize: 8.8, fontWeight: 600 },
  acknowledgementSub: { color: palette.muted, fontSize: 6.8, marginTop: 2 },
  commentBox: { borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 11, minHeight: 74, backgroundColor: palette.white },
  signatureGrid: { flexDirection: 'row', marginTop: 12, marginLeft: -5, marginRight: -5 },
  signatureCol: { width: '50%', padding: 5 },
  signatureBox: { minHeight: 62, borderWidth: 1, borderColor: palette.line, borderRadius: 9, padding: 10 },
  signatureLabel: { color: palette.muted, fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 0.5 },

  hrBanner: { borderRadius: 12, backgroundColor: palette.ink, padding: 16, marginBottom: 14 },
  hrBannerKicker: { color: '#bfe7c8', fontSize: 6.8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.1 },
  hrBannerTitle: { color: palette.white, fontSize: 16, fontWeight: 600, marginTop: 5 },
  hrScoreRow: { flexDirection: 'row', marginTop: 14 },
  hrScoreBox: { width: 110, backgroundColor: palette.green, borderRadius: 10, padding: 10, marginRight: 10 },
  hrScoreValue: { color: palette.white, fontSize: 20, fontWeight: 600 },
  hrScoreLabel: { color: '#e8f7ec', fontSize: 6.3, marginTop: 2, textTransform: 'uppercase' },
  hrStatementBox: { flex: 1, backgroundColor: '#1c2c40', borderRadius: 10, padding: 10 },
  hrStatementLabel: { color: '#9fb0c4', fontSize: 6.2, textTransform: 'uppercase' },
  hrStatement: { color: palette.white, fontSize: 10, fontWeight: 600, marginTop: 4 },
  formulaNote: { color: palette.muted, fontSize: 6.8, marginTop: 9, lineHeight: 1.4 },
});

const val = (value) => (value === null || value === undefined || String(value).trim() === '' ? '-' : String(value));
const roleKey = (role) => String(role || '').toLowerCase().replace(/ /g, '_');
const PdfChrome = ({ t }) => (
  <>
    <View style={styles.fixedHeader} fixed>
      <View style={styles.brandWrap}>
        <Text style={styles.brandMark}>L</Text>
        <View>
          <Text style={styles.brandName}>Lambert Electromec</Text>
          <Text style={styles.brandSub}>{t('pdf.brandSub')}</Text>
        </View>
      </View>
      <View style={styles.docMeta}>
        <Text style={styles.docMetaTitle}>{t('pdf.staffEvaluation')}</Text>
        <Text style={styles.docMetaLine}>{t('pdf.documentMetadata')}</Text>
      </View>
    </View>
    <View style={styles.fixedFooter} fixed>
      <Text>{t('pdf.confidential')}</Text>
      <Text render={({ pageNumber, totalPages }) => t('pdf.pageCount', { page: pageNumber, total: totalPages })} />
    </View>
  </>
);

const SectionHeading = ({ kicker, title, description }) => (
  <View style={styles.sectionHeadingWrap} minPresenceAhead={52}>
    <Text style={styles.sectionKicker}>{kicker}</Text>
    <Text style={styles.sectionHeading}>{title}</Text>
    {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
  </View>
);

const InfoCard = ({ label, value }) => (
  <View style={styles.infoCard}>
    <View style={styles.infoCardInner}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{val(value)}</Text>
    </View>
  </View>
);

const sectionScore = (scores, code) => scores.find((row) => row.section_code === code)?.section_avg ?? null;
const sectionModeLabel = (section, t) => {
  if (section?.rating_mode === 'overall') return t('pdf.overallSection');
  if (section?.rating_mode === 'historical_summary') return t('pdf.historicalSummary');
  if (section?.section_type === 'kpi' && section?.question_weighting_mode === 'custom') return t('pdf.customWeights');
  if (section?.section_type === 'kpi') return t('pdf.equalWeights');
  return t('pdf.perQuestion');
};

const ResponseCard = ({ section, response, index, t, locale }) => {
  const hasWeight = section.section_type === 'kpi'
    && section.question_weighting_mode === 'custom'
    && response.question_weight !== null
    && response.question_weight !== undefined
    && response.question_weight !== '';
  const details = [
    response.objective_target ? { label: t('pdf.targetMeasure'), value: response.objective_target } : null,
    response.actual_result ? { label: t('pdf.actualResult'), value: response.actual_result } : null,
    response.evidence_source ? { label: t('pdf.evidenceSource'), value: response.evidence_source } : null,
    response.rating_comment ? { label: t('pdf.ratingComment'), value: response.rating_comment } : null,
  ].filter(Boolean);

  return (
    <View style={styles.responseCard}>
      <View style={styles.responseTop}>
        <Text style={styles.responseIndex}>{index + 1}</Text>
        <View style={styles.responseQuestionWrap}>
          <Text style={styles.responseQuestion}>{val(response.question_text)}</Text>
          {hasWeight ? <Text style={styles.responseWeight}>{t('pdf.questionWeight', { weight: pdfPercentPoints(response.question_weight, locale) })}</Text> : null}
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingBadgeValue}>{pdfScore(response.rating, locale)}</Text>
          <Text style={styles.ratingBadgeLabel}>{t('pdf.rating')}</Text>
        </View>
      </View>
      {details.length > 0 ? (
        <View style={styles.detailRow}>
          {details.slice(0, 2).map((detail) => (
            <View style={styles.detailCol} key={detail.label}>
              <Text style={styles.detailLabel}>{detail.label}</Text>
              <Text style={styles.detailText}>{val(detail.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {details.length > 2 ? (
        <View style={styles.detailRow}>
          {details.slice(2, 4).map((detail) => (
            <View style={styles.detailCol} key={detail.label}>
              <Text style={styles.detailLabel}>{detail.label}</Text>
              <Text style={styles.detailText}>{val(detail.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const AppraisalPdfDocument = ({ appraisal, role, locale = 'en' }) => {
  const t = i18n.getFixedT(locale, 'appraisals');
  const displayStatus = (status) => t(`view.status.${status === 'pending_acknowledgement' ? 'pendingAcknowledgement' : status}`, { defaultValue: val(status) });
  const normalizedRole = roleKey(role);
  const isStaff = normalizedRole === 'staff';
  const canSeeHrPage = ['admin', 'super_admin'].includes(normalizedRole);
  const scores = Array.isArray(appraisal?.section_scores) ? appraisal.section_scores : [];
  const sections = Array.isArray(appraisal?.sections) ? appraisal.sections : [];
  const ratingBands = Array.isArray(appraisal?.rating_config?.rating_bands) && appraisal.rating_config.rating_bands.length
    ? appraisal.rating_config.rating_bands
    : [
      { label: t('pdf.fallbackUnsatisfactory'), min_score: 1, max_score: 1.49 },
      { label: t('pdf.fallbackNeedsImprovement'), min_score: 1.5, max_score: 2.49 },
      { label: t('pdf.fallbackFullyMeets'), min_score: 2.5, max_score: 3.49 },
      { label: t('pdf.fallbackExceeds'), min_score: 3.5, max_score: 4.49 },
      { label: t('pdf.fallbackOutstanding'), min_score: 4.5, max_score: 5 },
    ];

  return (
    <Document title={t('pdf.documentTitle', { name: val(appraisal?.staff_fullname), year: val(appraisal?.cycle_year) })} author="Lambert Electromec Ltd">
      <Page size="A4" style={styles.page}>
        <PdfChrome t={t} />

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{t('pdf.annualReview')}</Text>
          <Text style={styles.heroTitle}>{val(appraisal?.staff_fullname)}</Text>
          <Text style={styles.heroSub}>{val(appraisal?.staff_job_title_display || appraisal?.staff_job_title)}  |  {val(appraisal?.staff_department_display || appraisal?.staff_department)}  |  {val(appraisal?.cycle_title)} - {val(appraisal?.cycle_year)}</Text>
          <View style={styles.heroScoreRow}>
            <View style={styles.scorePill}>
              <Text style={styles.scorePillValue}>{pdfScore(appraisal?.appraisal_summary, locale)}</Text>
              <Text style={styles.scorePillLabel}>{t('pdf.overallScore')}</Text>
            </View>
            <View style={styles.statementPill}>
              <Text style={styles.statementText}>{val(appraisal?.evaluation_statement)}</Text>
            </View>
          </View>
          {(Number(appraisal?.serious_breach_declared) === 1 || Number(appraisal?.breach_cap_active) === 1) && (
            <Text style={styles.heroSub}>
              {t('pdf.breachStatement', {
                cap: t(Number(appraisal?.breach_cap_active) === 1 ? 'pdf.breachCapApplies' : 'pdf.breachCapNone'),
                score: pdfScore(appraisal?.raw_appraisal_summary ?? appraisal?.appraisal_summary, locale),
                verification: ({ confirmed: t('view.breach.confirmed'), dismissed: t('view.breach.dismissed'),
                  pending: t('view.breach.pending'), not_required: t('view.breach.notRequired'),
                  awaiting_review: t('view.breach.awaitingReview') })[appraisal?.serious_breach_review_status]
                  || val(appraisal?.serious_breach_review_status),
              })}
            </Text>
          )}
        </View>

        <SectionHeading kicker={t('pdf.employeeProfile')} title={t('pdf.assessmentInfo')} description={t('pdf.assessmentInfoDescription')} />
        <View style={styles.infoGrid}>
          <InfoCard label={t('pdf.employeeName')} value={appraisal?.staff_fullname} />
          <InfoCard label={t('pdf.department')} value={appraisal?.staff_department_display || appraisal?.staff_department} />
          <InfoCard label={t('pdf.jobTitle')} value={appraisal?.staff_job_title_display || appraisal?.staff_job_title} />
          <InfoCard label={t('pdf.location')} value={appraisal?.staff_location} />
          <InfoCard label={t('pdf.supervisor')} value={appraisal?.supervisor_name} />
          <InfoCard label={t('pdf.appraisalStatus')} value={displayStatus(appraisal?.status)} />
          <InfoCard label={t('pdf.assessmentPeriod')} value={`${val(appraisal?.cycle_title)} - ${val(appraisal?.cycle_year)}`} />
          <InfoCard label={t('pdf.assessmentDate')} value={pdfDate(appraisal?.created_at, locale)} />
        </View>

        <SectionHeading kicker={t('pdf.ratingFramework')} title={t('pdf.scoreStandard')} description={t('pdf.scoreStandardDescription')} />
        <View style={styles.bandGrid}>
          {ratingBands.map((band) => (
            <View style={styles.bandCard} key={`${band.label}-${band.min_score}-${band.max_score}`}>
              <View style={styles.bandCardInner}>
                <Text style={styles.bandLabel}>{val(band.label)}</Text>
                <Text style={styles.bandRange}>{locale === 'fr' ? pdfScore(band.min_score, locale) : val(band.min_score)} - {locale === 'fr' ? pdfScore(band.max_score, locale) : val(band.max_score)}</Text>
              </View>
            </View>
          ))}
        </View>

      </Page>

      <Page size="A4" style={styles.page} wrap>
        <PdfChrome t={t} />
        {!isStaff && (
          <View wrap={false} style={styles.scoringBlock}>
            <SectionHeading kicker={t('pdf.scoringModel')} title={t('pdf.achievementFactors')} description={t('pdf.achievementDescription')} />
            <View style={styles.table} wrap={false}>
              <View style={styles.tableHeader}>
                <View style={styles.tableCellMain}><Text style={styles.tableHeaderText}>{t('pdf.section')}</Text></View>
                <View style={styles.tableCellRight}><Text style={styles.tableHeaderText}>{t('pdf.weight')}</Text></View>
              </View>
              {scores.map((score, index) => (
                <View style={index === scores.length - 1 ? styles.tableRowLast : styles.tableRow} key={score.section_id} wrap={false}>
                  <View style={styles.tableCellMain}>
                    <Text style={styles.tableMainText}>{score.section_code}. {score.section_label}</Text>
                    <Text style={styles.tableSubText}>{t('pdf.sectionRatingInline', { score: pdfScore(score.section_avg, locale) })}</Text>
                  </View>
                  <View style={styles.tableCellRight}><Text style={styles.tableValue}>{pdfPercentPoints(score.section_weight, locale)}</Text></View>
                </View>
              ))}
            </View>
          </View>
        )}
        <SectionHeading kicker={t('pdf.performanceAssessment')} title={t('pdf.sectionRatings')} description={t('pdf.sectionRatingsDescription')} />
        {sections.map((section) => (
          <View key={section.section_id} style={styles.sectionCard}>
            <View style={styles.sectionBar} wrap={false} minPresenceAhead={68}>
              <View style={styles.sectionBarLeft}>
                <Text style={styles.sectionCode}>{t('pdf.sectionIdentifier', { code: section.section_code })}</Text>
                <Text style={styles.sectionName}>{section.section_label}</Text>
                <Text style={styles.sectionMode}>{sectionModeLabel(section, t)}</Text>
              </View>
              <View style={styles.sectionRating}>
                <Text style={styles.sectionRatingValue}>{pdfScore(sectionScore(scores, section.section_code), locale)}</Text>
                <Text style={styles.sectionRatingLabel}>{t('pdf.sectionRating')}</Text>
              </View>
            </View>
            {(section.responses || []).map((response, index) => (
              <ResponseCard key={`${section.section_id}-${response.question_id || index}`} section={section} response={response} index={index} t={t} locale={locale} />
            ))}
            {section.overall_rating_comment ? (
              <View style={styles.overallNote} wrap={false}>
                <Text style={styles.detailLabel}>{t('pdf.overallSectionComment')}</Text>
                <Text style={styles.detailText}>{section.overall_rating_comment}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </Page>

      <Page size="A4" style={styles.page}>
        <PdfChrome t={t} />
        <SectionHeading kicker={t('pdf.supervisorRecommendations')} title={t('pdf.recommendedActions')} description={t('pdf.recommendedDescription')} />
        <View style={styles.recommendationGrid}>
          <View style={styles.recommendationCard}>
            <View style={styles.recommendationInner}>
              <Text style={styles.recommendationLabel}>{t('pdf.statusUpgrade')}</Text>
              <Text style={styles.recommendationText}>{val(appraisal?.status_upgrade)}</Text>
            </View>
          </View>
          <View style={styles.recommendationCard}>
            <View style={styles.recommendationInner}>
              <Text style={styles.recommendationLabel}>{t('pdf.salaryUpgrade')}</Text>
              <Text style={styles.recommendationText}>{val(appraisal?.salary_upgrade)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.recommendationInnerWide}>
          <Text style={styles.recommendationLabel}>{t('pdf.developmentTraining')}</Text>
          <Text style={styles.recommendationText}>{val(appraisal?.development)}</Text>
        </View>

        <SectionHeading kicker={t('pdf.employeeResponse')} title={t('pdf.acknowledgementComment')} description={t('pdf.acknowledgementDescription')} />
        <View style={styles.acknowledgementBanner}>
          <View style={styles.acknowledgementDot} />
          <View>
            <Text style={styles.acknowledgementTitle}>{displayStatus(appraisal?.status)}</Text>
            <Text style={styles.acknowledgementSub}>{appraisal?.acknowledged_at ? t('pdf.acknowledgedOn', { date: pdfDate(appraisal.acknowledged_at, locale) }) : t('pdf.acknowledgementPending')}</Text>
          </View>
        </View>
        <View style={styles.commentBox}>
          <Text style={styles.detailLabel}>{t('pdf.employeeComment')}</Text>
          <Text style={styles.recommendationText}>{val(appraisal?.feedback)}</Text>
        </View>

        <View style={styles.signatureGrid}>
          <View style={styles.signatureCol}><View style={styles.signatureBox}><Text style={styles.signatureLabel}>{t('pdf.employeeSignature')}</Text></View></View>
          <View style={styles.signatureCol}><View style={styles.signatureBox}><Text style={styles.signatureLabel}>{t('pdf.supervisorSignature')}</Text></View></View>
        </View>
      </Page>

      {canSeeHrPage && (
        <Page size="A4" style={styles.page}>
          <PdfChrome t={t} />
          <View style={styles.hrBanner}>
            <Text style={styles.hrBannerKicker}>{t('pdf.hrOnly')}</Text>
            <Text style={styles.hrBannerTitle}>{t('pdf.finalAppraisalSummary')}</Text>
            <View style={styles.hrScoreRow}>
              <View style={styles.hrScoreBox}>
                <Text style={styles.hrScoreValue}>{pdfScore(appraisal?.appraisal_summary, locale)}</Text>
                <Text style={styles.hrScoreLabel}>{t('pdf.finalScore')}</Text>
              </View>
              <View style={styles.hrStatementBox}>
                <Text style={styles.hrStatementLabel}>{t('pdf.evaluationStatement')}</Text>
                <Text style={styles.hrStatement}>{val(appraisal?.evaluation_statement)}</Text>
              </View>
            </View>
            <Text style={styles.formulaNote}>{t('pdf.formulaNote')}</Text>
          </View>

          <SectionHeading kicker={t('pdf.employee')} title={val(appraisal?.staff_fullname)} description={`${val(appraisal?.staff_department_display || appraisal?.staff_department)} | ${val(appraisal?.staff_job_title_display || appraisal?.staff_job_title)}`} />
          <View style={styles.recommendationGrid}>
            <View style={styles.recommendationCard}>
              <View style={styles.recommendationInner}>
                <Text style={styles.recommendationLabel}>{t('pdf.statusRecommendation')}</Text>
                <Text style={styles.recommendationText}>{val(appraisal?.status_upgrade)}</Text>
              </View>
            </View>
            <View style={styles.recommendationCard}>
              <View style={styles.recommendationInner}>
                <Text style={styles.recommendationLabel}>{t('pdf.salaryRecommendation')}</Text>
                <Text style={styles.recommendationText}>{val(appraisal?.salary_upgrade)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.recommendationInnerWide}>
            <Text style={styles.recommendationLabel}>{t('pdf.developmentRecommendation')}</Text>
            <Text style={styles.recommendationText}>{val(appraisal?.development)}</Text>
          </View>

          <View style={[styles.signatureBox, { marginTop: 18, minHeight: 78 }]}>
            <Text style={styles.signatureLabel}>{t('pdf.hrSignature')}</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};

export default AppraisalPdfDocument;
