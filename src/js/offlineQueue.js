const QUEUE_KEY = 'hcr_flha_pending_queue';

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addToQueue(submission) {
  const queue = getQueue();
  queue.push({ ...submission, queuedAt: new Date().toISOString(), localId: crypto.randomUUID() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeFromQueue(localId) {
  const queue = getQueue().filter(q => q.localId !== localId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}
