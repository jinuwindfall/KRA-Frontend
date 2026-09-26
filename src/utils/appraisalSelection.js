// Picking "which of my appraisals am I working on" is an HR decision, not a guess, once
// there's more than one to choose from: HR opens the rating section
// (mark_entry_access_open) on exactly the appraisal they want the appraisee to see, so
// that one wins over whichever merely has the latest period_to. With a single appraisal
// (the common case) we still open it regardless, so this never blocks the normal flow.
export function pickActiveAppraisal(list = []) {
  const appraisals = list || [];
  if (appraisals.length === 0) return null;
  if (appraisals.length === 1) return appraisals[0];

  const openOnes = appraisals.filter((appraisal) => appraisal?.mark_entry_access_open);
  const candidates = openOnes.length > 0 ? openOnes : appraisals;

  return [...candidates].sort((a, b) => {
    const aPeriod = a?.period_to ? new Date(a.period_to).getTime() : 0;
    const bPeriod = b?.period_to ? new Date(b.period_to).getTime() : 0;
    if (bPeriod !== aPeriod) return bPeriod - aPeriod;

    const aUpdated = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bUpdated = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bUpdated - aUpdated;
  })[0];
}
