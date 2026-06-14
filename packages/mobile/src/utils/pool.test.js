const { dedupePoolsById, filterActivePools, getPoolId } = require('./pool');

describe('pool utils', () => {
  const poolA = { _id: '6a2e5d69b5cbc76b295225ea', status: 'open', destination: { name: 'City' } };
  const poolADuplicate = { _id: '6a2e5d69b5cbc76b295225ea', status: 'full', destination: { name: 'City Updated' } };
  const poolB = { _id: 'abc123', status: 'open' };

  test('dedupePoolsById keeps the latest entry for the same pool id', () => {
    const result = dedupePoolsById([poolA, poolADuplicate, poolB]);
    expect(result).toHaveLength(2);
    expect(getPoolId(result[0])).toBe('6a2e5d69b5cbc76b295225ea');
    expect(result[0].status).toBe('full');
  });

  test('filterActivePools removes duplicates and inactive pools', () => {
    const result = filterActivePools([
      poolA,
      poolADuplicate,
      poolB,
      { _id: 'done1', status: 'completed' },
    ]);

    expect(result).toHaveLength(2);
    expect(result.every((pool) => ['open', 'full', 'in_progress'].includes(pool.status))).toBe(true);
  });
});
