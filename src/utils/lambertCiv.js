/** Approved company identity. The company is created only via the Super Admin API. */
export const APPROVED_LAMBERT_CIV = Object.freeze({ code: 'LAMBERT_CIV', name: 'Lambert CIV' });

export const findLambertCiv = (companies = []) => (companies || []).find(
  (company) => String(company?.code || '').trim().toUpperCase() === APPROVED_LAMBERT_CIV.code,
) || null;

export const lambertCivIdentityMatches = (company) => !!company &&
  String(company.name || '').trim().toLocaleLowerCase('en') === APPROVED_LAMBERT_CIV.name.toLocaleLowerCase('en');
