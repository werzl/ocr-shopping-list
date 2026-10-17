import { Fragment, useState, useRef, useEffect, type ChangeEvent } from "react";
import { ToastContainer, toast } from "react-toastify";
import { Container, Row, Col, Navbar, Button, Spinner } from "react-bootstrap";
import { categoryOrder, classifyItem } from './categories';

import notepadLogo from "./assets/notepad.png";
import OpenAiWrapper from "./openai/OpenAiWrapper";
import EditIcon from "./assets/pen-to-square-solid-full.svg?react";
import LeftIcon from "./assets/arrow-left-solid-full.svg?react";
import PhotoIcon from "./assets/photo-film-solid-full.svg?react";
import TrashIcon from "./assets/trash-solid-full.svg?react";

import "./App.css";

import { loadSession, saveSession, isStorageFull, type ShoppingListItem } from './storage';

import { compressImage } from './compressImage';

const appVersion = __APP_VERSION__; // Injected at build time from vite.config.ts

function imageToDataUrl(image: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read image'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'));
    reader.readAsDataURL(image);
  });
}

function App() {
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [newItem, setNewItem] = useState<string | null>(null);
  const snapshot = useRef<{ items: ShoppingListItem[]; image: Blob | null; fileName: string } | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const [image, setImage] = useState<Blob | null>(null);
  const savedImage = useRef<Blob | null>(null);
  const [shoppingList, setShoppinglist] = useState<ShoppingListItem[]>([]);
  const [categories, setCategories] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [saveRetry, setSaveRetry] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const saveVersion = useRef(0);
  const saveQueue = useRef(Promise.resolve());

  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfirmed, setApiKeyConfirmed] = useState(false);

  const isBusy = isLoading || isPreparingImage;

  const shoppingListRef = useRef<HTMLDivElement>(null);
  const openAiWrapper = useRef<OpenAiWrapper | null>(null);
  const inputFileButtonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void loadSession().then(session => {
      if (!active)
        return;

      setShoppinglist(session.shoppingList);
      setCategories(session.categories ?? false);
      setImage(session.image);
      savedImage.current = session.image;
      setImageFileName(session.fileName);

      setStorageReady(true);
    }).catch((error: unknown) => {
      if (active)
        setStorageError(isStorageFull(error)
          ? 'Browser storage is full. Free some browser storage, then reload to retry. Existing data has been kept.'
          : 'Could not load saved data. Reload to retry; existing data has been kept.');
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady || isEditing)
      return;

    const version = ++saveVersion.current;
    setIsSaving(true);
    const session = { id: 'current' as const, shoppingList, ...(categories ? { categories: true } : {}), ...(image ? { imageId: 'current' as const } : {}), fileName: imageFileName };
    // Serialize snapshots so a stale write cannot overwrite a later edit.
    saveQueue.current = saveQueue.current.then(async () => {
      if (image === savedImage.current) {
        await saveSession(session);
      } else {
        await saveSession(session, image);
        savedImage.current = image;
      }
    }).then(() => {
      if (version === saveVersion.current)
        setStorageError('');
    }).catch((error: unknown) => {
      if (version !== saveVersion.current)
        return;

      setStorageError(isStorageFull(error)
        ? 'Browser storage is full. Your latest changes are only in this open page. Upload a smaller image or free some browser storage, then retry saving. Reloading may lose unsaved changes.'
        : 'Could not save changes. Keep this page open and retry saving.');
    }).finally(() => {
      if (version === saveVersion.current)
        setIsSaving(false);
    });
  }, [storageReady, shoppingList, categories, image, imageFileName, saveRetry, isEditing]);

  useEffect(() => {
    if (!image) {
      setImageUrl('');

      return;
    }

    const url = URL.createObjectURL(image);
    setImageUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    function beforeunload(e: BeforeUnloadEvent) {
      if (isEditing || newItem !== null || isLoading || isPreparingImage || isSaving || (storageReady && storageError)) {
        e.preventDefault();
        e.returnValue = true;
      }
    }

    window.addEventListener('beforeunload', beforeunload);

    return () => {
      window.removeEventListener('beforeunload', beforeunload);
    }
  }, [isEditing, newItem, isLoading, isPreparingImage, isSaving, storageReady, storageError]);

  async function processImage(source: Blob) {
    if (!openAiWrapper.current) {
      return;
    }

    setIsLoading(true);

    try {
      const commaSeparated = await openAiWrapper.current.recogniseHandwriting(await imageToDataUrl(source));
      const array = commaSeparated.split(',').map(name => name.trim()).filter(Boolean);
      const shoppingListObjects = array.map((v) => {
        return {
          name: v,
          checked: false
        }
      });

      setShoppinglist(items => [...items, ...shoppingListObjects]);
      setIsLoading(false);

      shoppingListRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    catch (e) {
      console.error(e);

      const message = e instanceof Error ? e.message : String(e);

      if (message.toLowerCase().includes("401")) {
        errorToast("Invalid API Key");
      }
      else {
        errorToast("Processing error");
      }

      setIsLoading(false);
    }
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || image || isBusy || newItem !== null)
      return;

    if (!openAiWrapper.current) {
      errorToast('Enter an API key before you upload an image.');

      return;
    }

    // Reset the input so a failed upload can use the same file.
    if (inputFileButtonRef.current) {
      inputFileButtonRef.current.value = "";
    }

    if (!isEditing) {
      startEditing();
    }

    setIsPreparingImage(true);
    try {
      const compressed = await compressImage(file);
      setImageFileName(file.name);
      setImage(compressed);
      await processImage(file);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : 'Could not prepare this image. Try a different photo.');
    } finally {
      setIsPreparingImage(false);
    }
  }

  function startEditing() {
    snapshot.current = { items: shoppingList, image, fileName: imageFileName };
    setIsEditing(true);
  }

  function cancelEditing() {
    if (snapshot.current) {
      setShoppinglist(snapshot.current.items);
      setImage(snapshot.current.image);
      setImageFileName(snapshot.current.fileName);
    }

    setEditingItem(null);
    setIsEditing(false);
  }

  function saveEditing() {
    setShoppinglist(items => items.map(item => ({ ...item, name: item.name.trim() })).filter(item => item.name));
    setEditingItem(null);
    setIsEditing(false);
    snapshot.current = null;
  }

  function addItem() {
    if (!isEditing) {
      setNewItem('');

      return;
    }

    setEditingItem(shoppingList.length);
    setShoppinglist(items => [...items, { name: '', checked: false }]);
  }

  function confirmNewItem() {
    const name = newItem?.trim();
    if (!name)
      return;

    setShoppinglist(items => [...items, { name, checked: false }]);
    setNewItem(null);
  }

  function handleClear() {
    setNewItem(null);
    setShoppinglist([]);
    setImageFileName("");
    setImage(null);
    setIsLoading(false);

  }

  function handleApiKeyConfirmation() {
    try {
      openAiWrapper.current = new OpenAiWrapper(apiKey);
      void openAiWrapper.current.testApiKey();
    }
    catch (e) {
      console.error(e);
      errorToast("Invalid API Key");

      return;
    }

    setApiKeyConfirmed(true);
  }

  function handleBack() {
    openAiWrapper.current = null;

    setApiKey("");
    setApiKeyConfirmed(false);
  }

  function errorToast(message: string) {
    toast.error(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: true,
      progress: undefined,
      theme: "colored",
    });
  }

  function handleCheck(index: number, checked: boolean) {
    const newList = shoppingList.map((item, itemIndex) =>
      itemIndex === index ? { ...item, checked } : item
    );

    setShoppinglist(newList);
  }

  const displayItems = shoppingList.map((item, index) => ({ item, index, category: classifyItem(item.name) }));
  if (categories) {
    displayItems.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
  }

  return (
    <Container className="app-shell">
      <Row>
        <Col>
          {storageError && <p role="alert">{storageError}</p>}
          {storageError && storageReady && <Button variant="outline-primary" onClick={() => setSaveRetry(value => value + 1)}>Retry save</Button>}
          {!storageReady && !storageError && <p role="status">Loading saved list...</p>}
          {!apiKeyConfirmed &&
            <>
              <div>
                <h2 className="app-heading"><img src={notepadLogo} className="logo" alt="Notepad logo" />HandyList {appVersion}</h2>
              </div>
              <div className="api-key-panel">
                <form className="mt-3 text-center" >
                  <label htmlFor="apiKey">Enter an API Key</label>
                  <br />

                  <input type="password" id="apiKey" placeholder="API-Key" onChange={e => setApiKey(e.target.value)} className="form-control mt-2" />

                  <br /><br />

                  <Button disabled={!storageReady} variant="outline-primary" onClick={() => handleApiKeyConfirmation()}>
                    Submit
                  </Button>
                </form>
              </div>
            </>
          }

          {apiKeyConfirmed &&
            <Row className="workspace g-4">
              <Col xs={12} className="list-heading">
                <h3>HandyList {appVersion}</h3>
                {!isEditing && <button type="button" className="edit-list-icon" aria-label="Edit" title="Edit list" onClick={startEditing} disabled={isBusy || newItem !== null || shoppingList.length === 0}>
                  <EditIcon width="18" height="18" aria-hidden="true" />
                </button>}
              </Col>
              <Col xs={12}>
                <label className="d-inline-flex align-items-center gap-2 py-2">
                  <input type="checkbox" checked={categories} disabled={isBusy || isEditing || newItem !== null}
                    onChange={e => setCategories(e.target.checked)} />
                  Categorise
                </label>
              </Col>
              {image && <Col xs={12}>
                <details className="source-photo">
                  <summary>
                    <img src={imageUrl || undefined} className="uploaded-image" alt={imageFileName || 'Uploaded shopping list'} />
                    <span className="source-photo-label"><strong>Uploaded photo</strong><small>{imageFileName || 'View photo'}</small></span>
                    <svg className="source-photo-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                  </summary>
                  <img src={imageUrl || undefined} className="source-photo-full" alt="Full source photo" />
                </details>
              </Col>}

              <Col xs={12} className="shopping-list-panel" role="region" aria-label="Shopping list" aria-busy={isBusy}>
                <div className={`shopping-list${isEditing ? ' shopping-list-editing' : ''}${shoppingList.length === 0 && newItem === null ? ' shopping-list-empty' : ''}`} ref={shoppingListRef} tabIndex={0} inert={isBusy}>
                  {shoppingList.length > 0 &&
                    <>
                      {displayItems.map(({ item, index, category }, position) => {
                        const key = `shopping-item-${index}`;

                        return (
                          <Fragment key={key}>
                          {categories && (position === 0 || displayItems[position - 1].category !== category) && <h4 className="mt-3 mb-2">{category}</h4>}
                          <div className={isEditing ? "item-editor" : "checkbox-wrapper-52"}>
                            {!isEditing && <label htmlFor={String(key)} className="item">
                              <input type="checkbox" id={String(key)} className="hidden" checked={item.checked} disabled={isEditing || isBusy} aria-label={item.name || `Item ${index + 1}`} onChange={(e) => handleCheck(index, e.target.checked)} />

                              <span className="cbx" aria-hidden="true">
                                <svg width="14px" height="12px" viewBox="0 0 14 12">
                                  <polyline points="1 7.6 5 11 13 1"></polyline>
                                </svg>
                              </span>

                              {!isEditing && <span className="cbx-lbl">{item.name}</span>}
                            </label>}
                            {isEditing && <>
                              <input
                                autoFocus={editingItem === index}
                                aria-label={`Item ${index + 1} name`}
                                className="form-control"
                                value={item.name}
                                onChange={e => setShoppinglist(items => items.map((value, position) => position === index ? { ...value, name: e.target.value } : value))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                              />
                              <Button variant="outline-danger" aria-label={`Remove item ${index + 1}`} onClick={() => setShoppinglist(items => items.filter((_, position) => position !== index))}>&#215;</Button>
                            </>}
                          </div></Fragment>);
                      })}
                    </>
                  }

                  {shoppingList.length === 0 && newItem === null && <div className="empty-list-splash">
                    <div className="empty-list-illustration" aria-hidden="true">
                      <svg viewBox="0 0 80 80" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="17" y="12" width="46" height="58" rx="7" />
                        <path d="M30 12v-3h20v3 M27 29l3 3 5-6 M42 29h12 M27 44l3 3 5-6 M42 44h12 M27 59h8 M42 59h12" />
                      </svg>
                    </div>
                    <h4>Handy List</h4>
                    <p>Add your first item and get ready for your next shop.</p>
                  </div>}
                  {newItem !== null && <div className="item-editor">
                    <input autoFocus className="form-control" aria-label="New item name" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => {
                      if (e.key === 'Enter') {
                        confirmNewItem();
                      }

                      if (e.key === 'Escape') {
                        setNewItem(null);
                      }
                    }} />
                    <Button variant="outline-success" aria-label="Confirm new item" onClick={confirmNewItem} disabled={!newItem.trim()}>&#10003;</Button>
                    <Button variant="outline-danger" aria-label="Cancel new item" onClick={() => setNewItem(null)}>&#215;</Button>
                  </div>}
                  <div className="list-actions">
                    <button type="button" className="add-item-button" aria-label="Add item" onClick={addItem} disabled={isBusy || newItem !== null}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14 M5 12h14" />
                      </svg>
                      Add item
                    </button>
                    <input ref={inputFileButtonRef} type="file" id="upload" accept="image/jpeg, image/jpg, image/png, image/webp, image/gif" onChange={handleImageUpload} hidden disabled={isBusy || !!image || newItem !== null} />
                    <button type="button" className="add-item-button" aria-label="Photo" onClick={() => inputFileButtonRef.current?.click()} disabled={isBusy || !!image || newItem !== null}>
                      <PhotoIcon aria-hidden="true" />
                      Photo
                    </button>
                  </div>
                </div>
                {isBusy && <div className="list-loading-overlay" role="status">
                  <Spinner animation="border" aria-hidden="true" />
                  <span className="visually-hidden">{isLoading ? 'Processing image' : 'Preparing image'}</span>
                </div>}
              </Col>
            </Row>
          }

          <ToastContainer />
        </Col>
      </Row>

      {apiKeyConfirmed &&
        <div className="navbar-dock">
        <Navbar className="app-nav-bar" aria-label="List actions">
          <button aria-label="Back" className="nav-button" onClick={handleBack} disabled={isBusy || isEditing}>
            <LeftIcon aria-hidden="true" />
            <span>Back</span>
          </button>
          {isEditing && <>
            <button aria-label="Cancel" className="nav-button" onClick={cancelEditing} disabled={isBusy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12 M18 6 6 18" /></svg>
              <span>Cancel</span>
            </button>
            <button aria-label="Save" className="nav-button nav-save" onClick={saveEditing} disabled={isBusy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
              <span>Save</span>
            </button>
          </>}
          <button aria-label="Clear" className="nav-button nav-clear" onClick={handleClear} disabled={isBusy || isEditing}>
            <TrashIcon aria-hidden="true" />
            <span>Clear</span>
          </button>
        </Navbar>
        </div>
      }
    </Container>
  );
}

export default App;
