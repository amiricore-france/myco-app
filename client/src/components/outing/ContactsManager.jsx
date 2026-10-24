import { useState } from 'react';
import { Trash2, UserPlus, Loader2 } from 'lucide-react';
import { api } from '../../api.js';
import { toast } from '../../lib/toast-store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/** Liste des proches à prévenir, avec cases à cocher pour la sortie à venir. */
export default function ContactsManager({ contacts, setContacts, selected, setSelected }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(contacts.length === 0);

  async function add() {
    setAdding(true);
    try {
      const c = await api('/outings/contacts', { method: 'POST', body: { name, email } });
      setContacts([...contacts, c].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected([...selected, c.id]);
      setName(''); setEmail('');
      setOpen(false);
    } catch (e) {
      toast.error('Ajout impossible', e.message);
    } finally { setAdding(false); }
  }

  async function remove(c) {
    try {
      await api(`/outings/contacts/${c.id}`, { method: 'DELETE' });
      setContacts(contacts.filter(x => x.id !== c.id));
      setSelected(selected.filter(id => id !== c.id));
    } catch (e) { toast.error('Suppression impossible', e.message); }
  }

  function toggle(id) {
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div>
      {contacts.length > 0 && (
        <ul className="mb-3 divide-y divide-neutral-100 rounded-md border border-neutral-200">
          {contacts.map(c => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <input id={`ct-${c.id}`} type="checkbox" className="h-5 w-5 accent-primary-600"
                checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
              <label htmlFor={`ct-${c.id}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-medium text-neutral-900">{c.name}</span>
                <span className="block truncate text-xs text-neutral-500">{c.email}</span>
              </label>
              <button type="button" onClick={() => remove(c)} aria-label={`Retirer ${c.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-md text-neutral-400 hover:bg-danger-50 hover:text-danger-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="grid gap-3 rounded-md border border-dashed border-neutral-300 p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <div>
            <Label htmlFor="ct-name">Prénom</Label>
            <Input id="ct-name" value={name} onChange={e => setName(e.target.value)} placeholder="Céline" className="mt-1 h-11" />
          </div>
          <div>
            <Label htmlFor="ct-email">E-mail</Label>
            <Input id="ct-email" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="celine@exemple.fr" className="mt-1 h-11" />
          </div>
          <Button type="button" onClick={add} disabled={adding || !name.trim() || !email.trim()} className="h-11">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Ajouter
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-11">
          <UserPlus className="h-4 w-4" /> Ajouter un proche
        </Button>
      )}
    </div>
  );
}
