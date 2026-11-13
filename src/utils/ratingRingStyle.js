// Shared style parameters for dashboard, appraisal, and employee rating gauges.
export const ratingRingStyle = (percentage) => {
  const parsed = Number(percentage);
  const progress = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;

  return {
    '--ring-progress': `${progress}%`,
    '--ring-angle': `${progress * 3.6}deg`,
    '--ring-start-visible': progress > 0 ? 1 : 0,
    '--ring-end-visible': progress > 0 && progress < 100 ? 1 : 0,
  };
};