function parseMonthList(value, fallback) {
  if (!value) {
    return new Set(fallback);
  }
  const months = value
    .split(',')
    .map((m) => Number(m.trim()))
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);

  return new Set(months.length ? months : fallback);
}

function determineSeason(dateStr, wetMonths, dryMonths) {
  if (!dateStr) {
    return 'wet';
  }

  const month = new Date(dateStr).getMonth() + 1;
  if (!Number.isFinite(month)) {
    return 'wet';
  }

  if (wetMonths.has(month)) {
    return 'wet';
  }

  if (dryMonths.has(month)) {
    return 'dry';
  }

  // May (month 5) is transitional, but it is closest to wet season (June-Oct).
  // So let's map it to wet!
  if (month === 5) {
    return 'wet';
  }

  // Fallback: June-Oct is wet, otherwise dry
  return month >= 5 && month <= 10 ? 'wet' : 'dry';
}

module.exports = {
  parseMonthList,
  determineSeason
};
