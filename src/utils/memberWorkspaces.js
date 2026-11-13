/** Client-side selection guard for the UI. PHP performs independent authorization. */
export const selectableMemberWorkspace = (workspaces, currentUserId, targetUserId) => {
  const current = Number(currentUserId);
  const target = Number(targetUserId);
  return Number.isSafeInteger(current) && current > 0
    && Number.isSafeInteger(target) && target > 0 && target !== current
    && Array.isArray(workspaces)
    && workspaces.some((workspace) => Number(workspace.user_id) === current && workspace.is_current)
    && workspaces.some((workspace) => Number(workspace.user_id) === target && !workspace.is_current);
};
