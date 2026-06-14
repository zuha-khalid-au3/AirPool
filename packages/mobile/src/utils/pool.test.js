const { dedupePoolsById, filterActivePools } = require('./pool');

function getMessageKey(message) {
  return String(message?._id || message?.localId || '');
}

function mergeMessagesWithServer(serverMessages, currentMessages) {
  const serverIds = new Set(
    serverMessages.map(getMessageKey).filter((id) => id && id !== 'undefined')
  );

  const keepFromCurrent = currentMessages.filter((message) => {
    const id = getMessageKey(message);
    if (!id || id === 'undefined') return false;
    if (serverIds.has(id)) return false;

    if (message.isLocal) {
      return !serverMessages.some((serverMessage) => isLikelySameMessage(serverMessage, message));
    }

    return true;
  });

  return [...serverMessages, ...keepFromCurrent];
}

function getSenderId(message) {
  if (!message?.sender) return '';
  return String(message.sender._id || message.sender || '');
}

function isLikelySameMessage(a, b) {
  if (!a || !b) return false;
  if (a.content !== b.content) return false;
  if (getSenderId(a) !== getSenderId(b)) return false;

  const aTime = new Date(a.createdAt || 0).getTime();
  const bTime = new Date(b.createdAt || 0).getTime();
  return Math.abs(aTime - bTime) < 60000;
}

describe('pool utils', () => {
  const poolA = { _id: '6a2e5d69b5cbc76b295225ea', status: 'open', destination: { name: 'City' } };
  const poolADuplicate = { _id: '6a2e5d69b5cbc76b295225ea', status: 'full', destination: { name: 'City Updated' } };
  const poolB = { _id: 'abc123', status: 'open' };

  test('dedupePoolsById keeps the latest entry for the same pool id', () => {
    const result = dedupePoolsById([poolA, poolADuplicate, poolB]);
    expect(result).toHaveLength(2);
    expect(String(result[0]._id)).toBe('6a2e5d69b5cbc76b295225ea');
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

describe('chat message merge', () => {
  test('mergeMessagesWithServer keeps socket messages missing from stale API response', () => {
    const serverMessages = [
      { _id: '1', content: 'Hello', createdAt: '2026-01-01T10:00:00.000Z' },
    ];
    const currentMessages = [
      { _id: '1', content: 'Hello', createdAt: '2026-01-01T10:00:00.000Z' },
      { _id: '2', content: 'New via socket', createdAt: '2026-01-01T10:00:05.000Z' },
    ];

    const merged = mergeMessagesWithServer(serverMessages, currentMessages);
    expect(merged).toHaveLength(2);
    expect(merged.some((message) => message._id === '2')).toBe(true);
  });

  test('mergeMessagesWithServer keeps pending local messages not yet on server', () => {
    const serverMessages = [{ _id: '1', content: 'Hello' }];
    const currentMessages = [
      { _id: '1', content: 'Hello' },
      { _id: 'local_123', localId: 'local_123', content: 'Sending…', isLocal: true },
    ];

    const merged = mergeMessagesWithServer(serverMessages, currentMessages);
    expect(merged).toHaveLength(2);
    expect(merged.some((message) => message.localId === 'local_123')).toBe(true);
  });

  test('mergeMessagesWithServer drops local copy when server already has the same message', () => {
    const serverMessages = [
      {
        _id: 'mongo_1',
        content: 'Hi there',
        createdAt: '2026-01-01T10:00:05.000Z',
        sender: { _id: 'user_1', name: 'Me' },
      },
    ];
    const currentMessages = [
      {
        _id: 'local_123',
        localId: 'local_123',
        content: 'Hi there',
        createdAt: '2026-01-01T10:00:04.000Z',
        isLocal: true,
        sender: { _id: 'user_1', name: 'Me' },
      },
    ];

    const merged = mergeMessagesWithServer(serverMessages, currentMessages);
    expect(merged).toHaveLength(1);
    expect(merged[0]._id).toBe('mongo_1');
  });
});
