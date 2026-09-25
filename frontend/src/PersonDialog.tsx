import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPerson, deletePerson, updatePerson, type Person, type PersonInput } from './api';

type Props = {
  // The person to update or delete, or undefined to add a new person
  person?: Person;
  onSaved: () => void;
  onClose: () => void;
};

// A pop-up form to add a person, or to update or delete an existing one
export function PersonDialog({ person, onSaved, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const isNew = !person;

  // Show the <dialog> as a modal as soon as it is on the page
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Runs an API call, showing an error in the dialog if it fails
  async function save(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      onSaved();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: PersonInput = {
      firstName: String(form.get('firstName')),
      lastName: String(form.get('lastName')),
      email: String(form.get('email')),
      notes: String(form.get('notes')) || undefined,
    };
    save(() => (isNew ? createPerson(input) : updatePerson(person.id, input)));
  }

  function handleDelete() {
    if (person && confirm(`Delete ${person.firstName} ${person.lastName}?`)) {
      save(() => deletePerson(person.id));
    }
  }

  return (
    // onClose also runs when the user presses Escape
    <dialog ref={dialogRef} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2>{isNew ? 'Add person' : `${person.firstName} ${person.lastName}`}</h2>

        <label>
          First name
          <input name="firstName" defaultValue={person?.firstName} required autoFocus />
        </label>
        <label>
          Last name
          <input name="lastName" defaultValue={person?.lastName} required />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={person?.email} required />
        </label>
        <label>
          Notes
          <textarea name="notes" defaultValue={person?.notes} rows={3} />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          {!isNew && (
            <button type="button" className="danger" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {isNew ? 'Add' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
