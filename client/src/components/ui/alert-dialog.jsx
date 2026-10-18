import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';

/**
 * AlertDialog — Utilisé principalement via le hook useConfirm().
 * Peut aussi être utilisé directement comme composant contrôlé.
 */
export function AlertDialog({
  open,
  onOpenChange,
  title = 'Confirmation',
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = true,
  onConfirm,
  loading = false,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {destructive && (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-danger-50">
                <AlertTriangle className="h-5 w-5 text-danger-600" />
              </div>
            )}
            <div className="flex-1">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1.5">{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
