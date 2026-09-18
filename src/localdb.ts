// Almacenamiento local (localStorage) con la misma forma que la API de Firestore
// que usa la app. Sin cuentas: todo vive en este dispositivo.

type Data = Record<string, any>;
type Store = Record<string, Record<string, Data>>;
type Filter = { field: string; op: '=='; value: any };
type Order = { field: string; dir: 'asc' | 'desc' };

const KEY = 'fotofarma:db';
const listeners = new Set<() => void>();

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

let store: Store = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Sin espacio: las fotos de recetas son lo más pesado, se quitan las más viejas.
    const recetas = Object.values(store.prescriptions || {})
      .filter(p => p.imageUrl)
      .sort((a, b) => (a.scannedAt || 0) - (b.scannedAt || 0));
    for (const p of recetas) {
      p.imageUrl = '';
      try {
        localStorage.setItem(KEY, JSON.stringify(store));
        break;
      } catch {}
    }
  }
  listeners.forEach(fn => fn());
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// --- Referencias ---
export interface CollectionRef { kind: 'collection'; name: string }
export interface DocRef { kind: 'doc'; col: string; id: string }
export interface Query { kind: 'query'; col: string; filters: Filter[]; orders: Order[] }

export const db = {};

export function collection(_db: unknown, name: string): CollectionRef {
  return { kind: 'collection', name };
}

export function doc(dbOrCol: unknown, colName?: string, id?: string): DocRef {
  if ((dbOrCol as CollectionRef)?.kind === 'collection') {
    return { kind: 'doc', col: (dbOrCol as CollectionRef).name, id: newId() };
  }
  return { kind: 'doc', col: colName!, id: id! };
}

export function where(field: string, op: '==', value: any): Filter {
  return { field, op, value };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): Order {
  return { field, dir };
}

export function query(col: CollectionRef, ...parts: (Filter | Order)[]): Query {
  return {
    kind: 'query',
    col: col.name,
    filters: parts.filter((p): p is Filter => 'op' in p),
    orders: parts.filter((p): p is Order => 'dir' in p),
  };
}

export function serverTimestamp() {
  return Date.now();
}

// --- Snapshots ---
function docSnap(col: string, id: string) {
  const data = store[col]?.[id];
  return {
    id,
    ref: { kind: 'doc', col, id } as DocRef,
    exists: () => data !== undefined,
    data: () => (data ? { ...data } : undefined),
  };
}

function run(q: Query | CollectionRef) {
  const col = q.kind === 'query' ? q.col : q.name;
  const filters = q.kind === 'query' ? q.filters : [];
  const orders = q.kind === 'query' ? q.orders : [];
  let ids = Object.keys(store[col] || {}).filter(id =>
    filters.every(f => store[col][id][f.field] === f.value)
  );
  for (const o of [...orders].reverse()) {
    ids.sort((a, b) => {
      const x = store[col][a][o.field], y = store[col][b][o.field];
      const c = x < y ? -1 : x > y ? 1 : 0;
      return o.dir === 'desc' ? -c : c;
    });
  }
  const docs = ids.map(id => docSnap(col, id));
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: any) => void) => docs.forEach(fn) };
}

export async function getDocs(q: Query | CollectionRef) {
  return run(q);
}

export async function getDoc(ref: DocRef) {
  return docSnap(ref.col, ref.id);
}

export function onSnapshot(target: DocRef | Query | CollectionRef, cb: (snap: any) => void, _onError?: (e: any) => void) {
  const emit = () => cb(target.kind === 'doc' ? docSnap(target.col, target.id) : run(target));
  listeners.add(emit);
  queueMicrotask(emit);
  return () => { listeners.delete(emit); };
}

// --- Escrituras ---
function write(ref: DocRef, data: Data, merge: boolean) {
  const col = (store[ref.col] ||= {});
  col[ref.id] = merge ? { ...col[ref.id], ...data } : { ...data };
}

export async function setDoc(ref: DocRef, data: Data, opts?: { merge?: boolean }) {
  write(ref, data, !!opts?.merge);
  persist();
}

export async function addDoc(col: CollectionRef, data: Data) {
  const ref = doc(col);
  await setDoc(ref, data);
  return ref;
}

export async function updateDoc(ref: DocRef, data: Data) {
  if (!store[ref.col]?.[ref.id]) throw new Error(`No existe ${ref.col}/${ref.id}`);
  write(ref, data, true);
  persist();
}

export async function deleteDoc(ref: DocRef) {
  delete store[ref.col]?.[ref.id];
  persist();
}

export function writeBatch(_db: unknown) {
  const ops: (() => void)[] = [];
  return {
    set(ref: DocRef, data: Data) { ops.push(() => write(ref, data, false)); },
    update(ref: DocRef, data: Data) { ops.push(() => write(ref, data, true)); },
    delete(ref: DocRef) { ops.push(() => { delete store[ref.col]?.[ref.id]; }); },
    async commit() { ops.forEach(op => op()); persist(); },
  };
}

// --- "Usuario" único del dispositivo (sin inicio de sesión) ---
const localUser = { uid: 'local', displayName: null as string | null };
export const auth = { currentUser: localUser };

export function onAuthStateChanged(_auth: unknown, cb: (u: typeof localUser) => void) {
  queueMicrotask(() => cb(localUser));
  return () => {};
}

export function handleFirestoreError(error: unknown, operationType: string, path: string | null) {
  console.error(`Error de almacenamiento (${operationType} ${path}):`, error);
  throw error;
}
