// Small functions that call the Persons API. VITE_API_URL is set when the website is built.
const apiUrl = import.meta.env.VITE_API_URL;

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  notes?: string;
};

// A person before it is saved: the API gives it an id
export type PersonInput = Omit<Person, 'id'>;

async function request<T>(method: string, path: string, body?: object): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with status ${response.status}`);
  }
  // DELETE returns 204 No Content, which has no JSON body
  return response.status === 204 ? (undefined as T) : response.json();
}

export const listPersons = () => request<Person[]>('GET', '/persons');
export const createPerson = (person: PersonInput) => request<Person>('POST', '/persons', person);
export const updatePerson = (id: string, person: PersonInput) =>
  request<Person>('PUT', `/persons/${id}`, person);
export const deletePerson = (id: string) => request<void>('DELETE', `/persons/${id}`);

// Uploads a CSV or JSON file of persons. The API gives a short-lived URL to upload it to S3 with;
// the persons in it are then created or updated in the background, a few seconds later.
export async function uploadPersonsFile(file: File) {
  const { uploadUrl } = await request<{ uploadUrl: string }>('POST', '/uploads', { fileName: file.name });
  const response = await fetch(uploadUrl, { method: 'PUT', body: file });
  if (!response.ok) {
    throw new Error(`Uploading ${file.name} failed with status ${response.status}`);
  }
}
