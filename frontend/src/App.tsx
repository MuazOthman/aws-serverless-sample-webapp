import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { listPersons, uploadPersonsFile, type Person } from './api';
import { PersonDialog } from './PersonDialog';

// What the dialog is showing: nothing, a new person being added, or an existing person
type DialogState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; person: Person };

export function App() {
  const [persons, setPersons] = useState<Person[]>();
  const [error, setError] = useState<string>();
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' });
  const [upload, setUpload] = useState<{ message: string; failed?: boolean }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load (or reload) the list of persons from the API
  async function refresh() {
    try {
      const all = await listPersons();
      all.sort((a, b) => fullName(a).localeCompare(fullName(b)));
      setPersons(all);
      setError(undefined);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Called by the dialog once a person was added, updated or deleted
  function handleSaved() {
    setDialog({ mode: 'closed' });
    refresh();
  }

  // Uploads the file picked in the (hidden) file input
  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so picking the same file again still triggers onChange
    if (!file) return;

    setUpload({ message: `Uploading ${file.name}…` });
    try {
      await uploadPersonsFile(file);
      setUpload({ message: `Uploaded ${file.name}. Its persons will show up in a few seconds.` });
      // The file is processed in the background, so give it a moment before reloading the list
      setTimeout(refresh, 3000);
    } catch (e) {
      setUpload({ message: String(e), failed: true });
    }
  }

  return (
    <main>
      <header>
        <h1>Persons</h1>
        <div className="header-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            hidden
            onChange={handleFileChosen}
          />
          <button onClick={() => fileInputRef.current?.click()}>Upload file</button>
          <button className="primary" onClick={() => setDialog({ mode: 'add' })}>
            Add person
          </button>
        </div>
      </header>

      {upload && <p className={upload.failed ? 'error' : 'muted'}>{upload.message}</p>}

      {error && <p className="error">Could not load persons: {error}</p>}
      {!persons && !error && <p className="muted">Loading…</p>}
      {persons?.length === 0 && <p className="muted">No persons yet. Add the first one!</p>}

      {persons && persons.length > 0 && (
        <ul className="persons">
          {persons.map((person) => (
            <li key={person.id}>
              <button className="link" onClick={() => setDialog({ mode: 'edit', person })}>
                {fullName(person)}
              </button>
              <span className="muted">{person.email}</span>
            </li>
          ))}
        </ul>
      )}

      {dialog.mode !== 'closed' && (
        <PersonDialog
          person={dialog.mode === 'edit' ? dialog.person : undefined}
          onSaved={handleSaved}
          onClose={() => setDialog({ mode: 'closed' })}
        />
      )}
    </main>
  );
}

function fullName(person: Person) {
  return `${person.firstName} ${person.lastName}`;
}
