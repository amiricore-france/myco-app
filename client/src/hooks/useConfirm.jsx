import { useEffect, useState, useCallback } from 'react';
import { AlertDialog } from '../components/ui/alert-dialog';
import { askConfirm, resolveConfirm, subscribeConfirm } from '../lib/confirm-store';

/**
 * Hook qui retourne une fonction confirm(options) -> Promise<boolean>.
 * Utilisation :
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Supprimer ?', description: 'Action irréversible.' })) { ... }
 */
export function useConfirm() {
  return useCallback(options => askConfirm(
    typeof options === 'string' ? { title: options } : options
  ), []);
}

/**
 * Composant à monter une seule fois au niveau de l'app.
 * Affiche le dialogue quand confirm() est appelé.
 */
export function ConfirmRoot() {
  const [state, setState] = useState({ open: false, options: {} });

  useEffect(() => {
    const unsub = subscribeConfirm(action => {
      if (action.type === 'open') {
        setState({ open: true, options: action.options || {} });
      } else if (action.type === 'close') {
        setState(s => ({ ...s, open: false }));
      }
    });
    return unsub;
  }, []);

  const { options } = state;

  return (
    <AlertDialog
      open={state.open}
      onOpenChange={open => {
        if (!open) resolveConfirm(false);
      }}
      title={options.title || 'Confirmation'}
      description={options.description}
      confirmLabel={options.confirmLabel || 'Confirmer'}
      cancelLabel={options.cancelLabel || 'Annuler'}
      destructive={options.destructive !== false}
      onConfirm={() => resolveConfirm(true)}
    />
  );
}
