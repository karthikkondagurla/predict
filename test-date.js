function todayISTString() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffsetMs);
  return ist.toISOString().split('T')[0]; // Format: YYYY-MM-DD
}
console.log(todayISTString());
