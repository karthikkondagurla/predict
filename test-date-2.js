function todayISTString(now) {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffsetMs);
  return ist.toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

const d1 = new Date('2026-04-06T18:29:55Z');
console.log('18:29:55 UTC ->', todayISTString(d1));

const d2 = new Date('2026-04-06T18:30:05Z');
console.log('18:30:05 UTC ->', todayISTString(d2));
