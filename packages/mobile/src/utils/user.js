export const getUserId = (user) => {
  if (!user) return null;
  if (typeof user === 'string') return user;
  const id = user.id || user._id;
  return id ? String(id) : null;
};

export const idsMatch = (a, b) => {
  if (!a || !b) return false;
  return String(a) === String(b);
};
