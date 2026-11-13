/** Safe, same-origin notification links only. No URL supplied by an event may redirect externally. */
export const safeNotificationPath = (link) => {
  if (typeof link !== 'string' || !link) return '/notifications';
  if (!link.startsWith('/') || link.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(link)) {
    return '/notifications';
  }
  if (/%(?:2f|5c|0a|0d|00)/i.test(link)) return '/notifications';
  return link;
};

export const notificationCompanyDecision = (item, user, companies = []) => {
  const role = user?.role;
  const homeId = String(user?.company_id || '');
  const targetId = item?.company_id == null ? '' : String(item.company_id);
  if (!targetId) return { allowed: true, selection: null };
  if (role === 'super_admin') return { allowed: true, selection: targetId };
  if (targetId === homeId) return { allowed: true, selection: role === 'admin' ? '' : null };
  if (role !== 'admin') return { allowed: false, selection: null };
  const grant = companies.find((row) => !row.is_home && String(row.company_id) === targetId);
  return grant
    ? { allowed: true, selection: targetId }
    : { allowed: false, selection: null };
};
