let counter = 0;
const listeners = new Set();

export function emitToast(payload) {
  const id = ++counter;
  const duration =
    payload.variant === 'error' || payload.variant === 'warning' ? 5000 : 3000;
  const toast = {
    id,
    open: true,
    variant: payload.variant || 'default',
    title: payload.title || null,
    description: payload.description || null,
    duration,
  };
  listeners.forEach(fn => fn({ type: 'add', toast }));
  return id;
}

export function dismissToast(id) {
  listeners.forEach(fn => fn({ type: 'dismiss', id }));
}

export function removeToast(id) {
  listeners.forEach(fn => fn({ type: 'remove', id }));
}

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const toast = {
  success: (title, description) => emitToast({ variant: 'success', title, description }),
  error:   (title, description) => emitToast({ variant: 'error', title, description }),
  warning: (title, description) => emitToast({ variant: 'warning', title, description }),
  info:    (title, description) => emitToast({ variant: 'info', title, description }),
  default: (title, description) => emitToast({ variant: 'default', title, description }),
};
