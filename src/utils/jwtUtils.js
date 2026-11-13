/**
 * Deprecated. Browser authentication now relies on a server validated
 * HttpOnly cookie session; client code must not decode or retain JWTs.
 */
export const isTokenExpired = () => true;
export const decodeToken = () => null;
