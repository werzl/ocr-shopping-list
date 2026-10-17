import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { liveQuery } from 'dexie';
import { Button, Container, Modal, Spinner } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import OpenAiWrapper from './openai/OpenAiWrapper';
import ListEditor from './ListEditor';
import ListCard from './ListCard';
import EmptyListIllustration from './EmptyListIllustration';
import { popInList, popOutList } from './listMotion';
import { defaultListName, deleteList, listLists, loadList, type LoadedList, type SavedList } from './storage';
import notepadLogo from './assets/notepad.png';
import './App.css';

type Page = { type: 'gallery' } | { type: 'list'; list: LoadedList; isNew: boolean };
type PageAction = { type: 'back' } | { type: 'open'; list: LoadedList; isNew: boolean };

function pageReducer(_page: Page, action: PageAction): Page {
  return action.type === 'back' ? { type: 'gallery' } : { type: 'list', list: action.list, isNew: action.isNew };
}

export default function App() {
  const [page, dispatch] = useReducer(pageReducer, { type: 'gallery' });
  const [client, setClient] = useState<OpenAiWrapper | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [lists, setLists] = useState<SavedList[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [opening, setOpening] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedList | null>(null);
  const [deleting, setDeleting] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const deletion = useRef<{ id: string; lists: SavedList[] | null; committed: boolean } | null>(null);
  const deleteAnimation = useRef<Animation | null>(null);
  const back = useCallback(() => dispatch({ type: 'back' }), []);
  const missing = useCallback(() => {
    dispatch({ type: 'back' });
    toast.info('This list no longer exists.');
  }, []);

  useEffect(() => {
    setReady(false);
    setLoadError('');
    const subscription = liveQuery(listLists).subscribe({
      next: result => {
        // Keep the deleted list visible until its exit animation ends.
        if (deletion.current)
          deletion.current.lists = result;
        else
          setLists(result);

        setReady(true);
      },
      error: error => {
        const message = `Could not load lists: ${reason(error)}`;
        setLoadError(message);
        toast.error(message);
      },
    });

    return () => subscription.unsubscribe();
  }, [reload]);

  const newListId = signedIn && page.type === 'list' && page.isNew ? page.list.id : null;
  useLayoutEffect(() => {
    const animation = newListId && workspaceRef.current ? popInList(workspaceRef.current) : null;

    return () => animation?.cancel();
  }, [newListId]);

  useEffect(() => () => {
    deletion.current = null;
    deleteAnimation.current?.cancel();
  }, []);

  const selectedId = page.type === 'list' && !page.isNew ? page.list.id : null;
  useEffect(() => {
    if (!selectedId)
      return;

    const subscription = liveQuery(() => loadList(selectedId)).subscribe({
      next: list => {
        if (!list && deletion.current?.id !== selectedId)
          missing();
      },
      error: error => toast.error(`Could not load this list: ${reason(error)}`),
    });

    // Check again when a suspended browser tab becomes active.
    const check = () => {
      if (document.visibilityState === 'visible')
        void loadList(selectedId).then(list => {
          if (!list && deletion.current?.id !== selectedId)
            missing();
        }).catch(error => toast.error(`Could not load this list: ${reason(error)}`));
    };

    document.addEventListener('visibilitychange', check);

    return () => { subscription.unsubscribe(); document.removeEventListener('visibilitychange', check); };
  }, [selectedId, missing]);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!apiKey.trim() || authenticating)
      return;

    setAuthenticating(true);
    try {
      const next = new OpenAiWrapper(apiKey.trim());
      await next.testApiKey();
      setClient(next);
      setApiKey('');
      setSignedIn(true);
    } catch {
      toast.error('Could not validate the API key. Check the key and your connection.');
    } finally {
      setAuthenticating(false);
    }
  }

  async function open(id: string) {
    setOpening(true);
    try {
      const list = await loadList(id);
      if (list)
        dispatch({ type: 'open', list, isNew: false });
      else
        missing();
    } catch (error) {
      toast.error(`Could not load this list: ${reason(error)}`);
    } finally {
      setOpening(false);
    }
  }

  function create() {
    const now = Date.now();
    dispatch({ type: 'open', isNew: true, list: {
      id: crypto.randomUUID(), name: defaultListName(), shoppingList: [], image: null,
      fileName: '', createdAt: now, updatedAt: now,
    } });
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting)
      return;

    setDeleting(true);
    const operation = { id: pendingDelete.id, lists: null as SavedList[] | null, committed: false };
    deletion.current = operation;
    try {
      await deleteList(pendingDelete.id);
      if (deletion.current !== operation)
        return;

      operation.committed = true;
      setPendingDelete(null);
    } catch (error) {
      if (deletion.current !== operation)
        return;

      deletion.current = null;
      if (operation.lists)
        setLists(operation.lists);

      setDeleting(false);
      toast.error(`Could not delete this list: ${reason(error)}`);
    }
  }

  async function finishDelete() {
    const operation = deletion.current;
    if (!operation?.committed)
      return;

    const target = page.type === 'list' ? workspaceRef.current
      : [...galleryRef.current?.querySelectorAll<HTMLElement>('[data-list-id]') ?? []]
        .find(card => card.dataset.listId === operation.id);

    const animation = target ? popOutList(target) : null;
    deleteAnimation.current = animation;

    await animation?.finished.catch(() => {});

    if (deletion.current !== operation)
      return;

    setLists(operation.lists ?? lists.filter(list => list.id !== operation.id));
    deletion.current = null;
    if (page.type === 'list' && page.list.id === operation.id)
      back();

    setDeleting(false);
    deleteAnimation.current = null;
  }

  return <>
    {!signedIn ? <Container className="app-shell">
      <h2 className="app-heading"><img src={notepadLogo} className="logo" alt="Notepad logo" />HandyList {__APP_VERSION__}</h2>
      <div className="api-key-panel">
        <form onSubmit={event => void login(event)}>
          <label htmlFor="apiKey">Enter an API Key</label>
          <input type="password" id="apiKey" placeholder="API-Key" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} className="form-control my-3" disabled={authenticating} />
          <Button type="submit" variant="outline-primary" disabled={!apiKey.trim() || authenticating}>{authenticating ? 'Checking key…' : 'Submit'}</Button>
        </form>
        <p className="mt-3">Your key stays in this page until you sign out or close it.</p>
        <Button variant="link" disabled={authenticating} onClick={() => { setApiKey(''); setSignedIn(true); }}>Continue without a key</Button>
      </div>
    </Container> : page.type === 'gallery' ? <Container className="app-shell gallery">
      <header className="gallery-heading">
        <h1 className="gallery-brand">HandyList {__APP_VERSION__}</h1>
        <Button variant="outline-primary" disabled={deleting} onClick={() => { setClient(null); setSignedIn(false); }}>{client ? 'Sign out' : 'Back'}</Button>
      </header>
      {!client && <p>Manual lists are available. Sign in with an API key to read photos.</p>}
      {loadError && <div role="alert"><p>{loadError}</p><Button onClick={() => setReload(value => value + 1)}>Retry</Button></div>}
      {!ready && !loadError && <p role="status"><Spinner as="span" size="sm" /> Loading lists…</p>}
      {ready && <>
        <div className="gallery-toolbar"><p>{lists.length} saved {lists.length === 1 ? 'list' : 'lists'}</p>
          <button type="button" className="add-item-button" onClick={create} disabled={opening || deleting} aria-label="Add list">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14 M5 12h14" />
            </svg>
            New list
          </button></div>
        {lists.length === 0 && <div className="gallery-empty">
          <EmptyListIllustration />
          <h2>Your next shop starts here</h2>
          <p>Create a list from a photo or add items manually.</p>
        </div>}
        <div ref={galleryRef} className="list-gallery">{lists.map(list => <ListCard key={list.id} list={list} disabled={opening || deleting} onOpen={() => void open(list.id)} onDelete={() => setPendingDelete(list)} />)}</div>
      </>}
    </Container> : <ListEditor key={page.list.id} initial={page.list} isNew={page.isNew} client={client} deleting={deleting} motionRef={workspaceRef}
      onBack={back} onMissing={missing} onDelete={list => setPendingDelete(list)}
      onSaved={list => dispatch({ type: 'open', list, isNew: false })} />}
    <Modal show={!!pendingDelete} onHide={() => {
      if (!deleting)
        setPendingDelete(null);
    }} onExited={() => void finishDelete()} centered backdrop={deleting ? 'static' : true} keyboard={!deleting}>
      <Modal.Header closeButton={!deleting}><Modal.Title>Delete list?</Modal.Title></Modal.Header>
      <Modal.Body>Delete “{pendingDelete?.name}” and its photo? You cannot restore them.</Modal.Body>
      <Modal.Footer><Button variant="secondary" disabled={deleting} onClick={() => setPendingDelete(null)}>Cancel</Button>
        <Button variant="danger" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? 'Deleting…' : 'Delete list'}</Button></Modal.Footer>
    </Modal>
    <ToastContainer position="top-right" theme="colored" />
  </>;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
