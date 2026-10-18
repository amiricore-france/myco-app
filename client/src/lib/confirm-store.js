let resolveFn = null;
const listeners = new Set();

export function askConfirm(options) {
  return new Promise(resolve => {
    resolveFn = resolve;
    listeners.forEach(fn => fn({ type: 'open', options }));
  });
}

export function resolveConfirm(value) {
  if (resolveFn) {
    resolveFn(value);
    resolveFn = null;
  }
  listeners.forEach(fn => fn({ type: 'close' }));
}

export function subscribeConfirm(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
