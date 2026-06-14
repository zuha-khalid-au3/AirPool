export function getPoolId(pool) {
  if (!pool?._id) return '';
  return String(pool._id);
}

export function dedupePoolsById(pools) {
  if (!Array.isArray(pools)) return [];

  const byId = new Map();
  pools.forEach((pool) => {
    const id = getPoolId(pool);
    if (id) byId.set(id, pool);
  });

  return Array.from(byId.values());
}

export function filterActivePools(pools) {
  return dedupePoolsById(pools).filter((pool) =>
    ['open', 'full', 'in_progress'].includes(pool.status)
  );
}
