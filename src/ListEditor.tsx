import { Fragment, useState, useRef, useEffect, useLayoutEffect, type ChangeEvent, type Ref } from "react";
import { toast } from "react-toastify";
import { Container, Row, Col, Navbar, Button, Spinner } from "react-bootstrap";
import { categoryOrder } from './categories';
import { itemCategory, reorderItems } from './reorderItems';
import DragHandle from './DragHandle';
import AnimatedDetails from './AnimatedDetails';
import EmptyListIllustration from './EmptyListIllustration';
import { animateRows, animateEditMode, popOutRow, shrinkList, revealEmptyList } from './listMotion';
import { animateNavbar, captureNavbar, type NavbarPositions } from './navbarMotion';
import { keepItemVisible } from './itemVisibility';

import OpenAiWrapper from "./openai/OpenAiWrapper";
import EditIcon from "./assets/pen-to-square-solid-full.svg?react";
import LeftIcon from "./assets/arrow-left-solid-full.svg?react";
import PhotoIcon from "./assets/photo-film-solid-full.svg?react";
import TrashIcon from "./assets/trash-solid-full.svg?react";

import "./App.css";

import { clearList, saveList, ListMissingError, isStorageFull, type LoadedList, type ShoppingListItem } from './storage';
import { useListDraft } from './useListDraft';

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

interface ListEditorProps {
  initial: LoadedList;
  isNew: boolean;
  client: OpenAiWrapper | null;
  deleting?: boolean;
  motionRef?: Ref<HTMLDivElement>;
  onBack: () => void;
  onSaved: (list: LoadedList) => void;
  onDelete: (list: LoadedList) => void;
  onMissing: () => void;
}

function ListEditor({ initial, isNew, client, deleting = false, motionRef, onBack, onSaved, onDelete, onMissing }: ListEditorProps) {
  const { draft, setName, setShoppinglist, setImage, setImageFileName, setCategories, restore } = useListDraft(initial);
  const { name, shoppingList, image, imageFileName, categories } = draft;
  const [isEditing, setIsEditing] = useState(isNew);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [newItem, setNewItem] = useState<string | null>(null);
  const snapshot = useRef(draft);
  const savedImage = useRef<Blob | null>(initial.image);
  const lastSaved = useRef(draft);
  const [moveMessage, setMoveMessage] = useState('');
  const itemKeys = useRef(new WeakMap<ShoppingListItem, string>());
  const newItemKeys = useRef(new Set<string>());
  const [imageUrl, setImageUrl] = useState('');
  const [storageError, setStorageError] = useState('');
  const [saveRetry, setSaveRetry] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const saveVersion = useRef(0);
  const saveQueue = useRef(Promise.resolve());

  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [isClearing, setIsClearing] = useState(false);
  const clearAnimation = useRef<Animation | null>(null);
  const revealAfterClear = useRef(false);
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [isRemovingRow, setIsRemovingRow] = useState(false);
  const blocksInput = deleting || isLoading || isPreparingImage || isChangingMode || isRemovingRow || isClearing;
  const isBusy = blocksInput || isSaving;
  const removalAnimation = useRef<Animation | null>(null);
  const focusAfterRemoval = useRef<number | null>(null);
  const modeAnimation = useRef<Animation | null>(null);
  const revealMode = useRef(false);

  useEffect(() => () => clearAnimation.current?.cancel(), []);
  useEffect(() => () => modeAnimation.current?.cancel(), []);
  useEffect(() => () => removalAnimation.current?.cancel(), []);

  const shoppingListRef = useRef<HTMLDivElement>(null);
  const revealNextItem = useRef(false);
  const stopItemReveal = useRef<(() => void) | null>(null);
  const revealCategories = useRef(false);

  useLayoutEffect(() => {
    if (!revealNextItem.current)
      return;

    revealNextItem.current = false;
    const input = document.activeElement;
    if (input instanceof HTMLInputElement && shoppingListRef.current?.contains(input)) {
      stopItemReveal.current?.();
      stopItemReveal.current = keepItemVisible(input, () => input.blur());
    }
  }, [shoppingList, newItem]);

  useEffect(() => () => stopItemReveal.current?.(), []);

  useLayoutEffect(() => {
    if (!revealCategories.current || !shoppingListRef.current)
      return;

    revealCategories.current = false;
    const animation = animateEditMode(shoppingListRef.current, false, true);

    return () => animation?.cancel();
  }, [categories]);
  const navbarRef = useRef<HTMLDivElement>(null);
  const navbarPositions = useRef<NavbarPositions>(new Map());

  useLayoutEffect(() => {
    if (!navbarRef.current)
      return;

    const cleanup = navbarPositions.current.size ? animateNavbar(navbarRef.current, navbarPositions.current) : undefined;
    navbarPositions.current = captureNavbar(navbarRef.current);

    return cleanup;
  }, [isEditing]);
  const rowPositions = useRef<Map<string, DOMRect> | null>(null);

  useLayoutEffect(() => {
    if (revealMode.current && shoppingListRef.current) {
      modeAnimation.current?.cancel();
      modeAnimation.current = animateEditMode(shoppingListRef.current, isEditing, true);
      revealMode.current = false;
    }
  }, [isEditing]);

  useLayoutEffect(() => {
    if (revealAfterClear.current && shoppingListRef.current) {
      clearAnimation.current?.cancel();
      clearAnimation.current = null;
      revealAfterClear.current = false;
      shoppingListRef.current.scrollTop = 0;
      revealEmptyList(shoppingListRef.current);
      shoppingListRef.current.querySelector<HTMLElement>('.add-item-button')?.focus({ preventScroll: true });
    }

    if (shoppingListRef.current && rowPositions.current)
      animateRows(shoppingListRef.current, rowPositions.current);

    rowPositions.current = null;
    if (focusAfterRemoval.current !== null && shoppingListRef.current) {
      const index = Math.min(focusAfterRemoval.current, shoppingList.length - 1);
      const focusTarget = shoppingListRef.current.querySelector<HTMLElement>(`[data-item-index="${index}"] .drag-handle`)
        ?? shoppingListRef.current.querySelector<HTMLElement>('.add-item-button');

      focusTarget?.focus({ preventScroll: true });
      focusAfterRemoval.current = null;
    }
  }, [shoppingList]);
  const openAiWrapper = useRef(client);
  const inputFileButtonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew || isEditing || (name === lastSaved.current.name && shoppingList === lastSaved.current.shoppingList && categories === lastSaved.current.categories && !saveRetry))
      return;

    const version = ++saveVersion.current;
    setIsSaving(true);
    const record = { ...initial, name, shoppingList, categories, fileName: imageFileName, updatedAt: Date.now() };
    // Keep writes in order so an older write cannot replace later changes.
    saveQueue.current = saveQueue.current.then(async () => {
      await saveList(record, undefined);
      lastSaved.current = { ...draft };
    }).then(() => {
      if (version === saveVersion.current)
        setStorageError('');
    }).catch((error: unknown) => {
      if (error instanceof ListMissingError) {
        onMissing();

        return;
      }

      if (version === saveVersion.current) {
        const message = `Could not save this list: ${failureReason(error)}`;
        setStorageError(message);
        errorToast(message);
      }
    }).finally(() => {
      if (version === saveVersion.current)
        setIsSaving(false);
    });
  }, [initial, draft, name, shoppingList, categories, imageFileName, saveRetry, isEditing, isNew, onMissing]);

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
      if (isEditing || newItem !== null || isLoading || isPreparingImage || isSaving || isClearing || storageError) {
        e.preventDefault();
        e.returnValue = true;
      }
    }

    window.addEventListener('beforeunload', beforeunload);

    return () => {
      window.removeEventListener('beforeunload', beforeunload);
    }
  }, [isEditing, newItem, isLoading, isPreparingImage, isSaving, isClearing, storageError]);

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

      const message = e instanceof Error ? e.message : String(e);

      if (message.toLowerCase().includes("401")) {
        errorToast("Invalid API Key");
      }
      else {
        errorToast(`Could not process this photo: ${failureReason(e)}`);
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
    snapshot.current = draft;
    setIsEditing(true);
  }

  async function changeEditing(editing: boolean, save = false) {
    if (isBusy)
      return;

    if (save) {
      await saveEditing();

      return;
    }

    if (shoppingListRef.current) {
      modeAnimation.current?.cancel();
      modeAnimation.current = animateEditMode(shoppingListRef.current, editing, false);
      if (modeAnimation.current) {
        setIsChangingMode(true);
        try {
          await modeAnimation.current.finished;
        } catch {
          return;
        }
      }

      revealMode.current = true;
    }

    if (editing)
      startEditing();
    else
      cancelEditing();

    setIsChangingMode(false);
  }

  function cancelEditing() {
    if (isNew) {
      onBack();

      return;
    }

    restore(snapshot.current);
    setEditingItem(null);
    setIsEditing(false);
  }

  async function saveEditing() {
    if (!name.trim()) {
      errorToast('Enter a list name.');

      return;
    }

    const items = shoppingList.map(item => ({ ...item, name: item.name.trim() })).filter(item => item.name);
    const record = {
      ...initial, name: name.trim(), shoppingList: items, categories,
      fileName: imageFileName, ...(image ? { imageId: initial.id } : {}), updatedAt: Date.now(),
    };

    setIsSaving(true);
    try {
      await saveQueue.current;
      await saveList(record, image === savedImage.current ? undefined : image, isNew);
      savedImage.current = image;
      setStorageError('');
      setShoppinglist(items);
      setEditingItem(null);
      setIsEditing(false);
      onSaved({ ...record, image });
    } catch (error) {
      if (error instanceof ListMissingError) {
        onMissing();

        return;
      }

      const message = `Could not save this list: ${failureReason(error)}`;
      setStorageError(message);
      errorToast(message);
    } finally {
      setIsSaving(false);
    }
  }

  function addItem() {
    if (isBusy)
      return;

    revealNextItem.current = true;
    if (!isEditing) {
      setNewItem('');

      return;
    }

    setEditingItem(shoppingList.length);
    const item = { name: '', checked: false };
    const key = crypto.randomUUID();
    itemKeys.current.set(item, key);
    newItemKeys.current.add(key);
    setShoppinglist(items => [...items, item]);
  }

  function confirmNewItem(continueAdding = false) {
    const name = newItem?.trim();
    if (!name || blocksInput)
      return;

    revealNextItem.current = continueAdding;
    setShoppinglist(items => [...items, { name, checked: false }]);
    setNewItem(continueAdding ? '' : null);
  }

  async function handleClear() {
    if (isBusy || isEditing || isNew)
      return;

    setIsClearing(true);
    try {
      await saveQueue.current;
      const cleared = await clearList(initial.id);
      const list = shoppingListRef.current;
      if (list && (shoppingList.length > 0 || image || newItem !== null)) {
        clearAnimation.current = shrinkList(list);
        await clearAnimation.current?.finished.catch(() => {});
      }

      const emptyDraft = {
        name: cleared.name, shoppingList: cleared.shoppingList, image: null,
        imageFileName: '', categories: cleared.categories ?? false,
      };

      savedImage.current = null;
      lastSaved.current = emptyDraft;
      revealAfterClear.current = true;
      restore(emptyDraft);
      setNewItem(null);
      setEditingItem(null);
      setStorageError('');
      setMoveMessage('Cleared the items and photo.');
      onSaved(cleared);
    } catch (error) {
      if (error instanceof ListMissingError) {
        onMissing();

        return;
      }

      errorToast(`Could not clear this list: ${failureReason(error)}`);
    } finally {
      setIsClearing(false);
    }
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

  async function removeItem(index: number) {
    if (!isEditing || isBusy)
      return;

    const item = shoppingList[index];
    const list = shoppingListRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-item-index="${index}"]`);
    if (!item || !list || !row)
      return;

    row.getAnimations?.().forEach(animation => animation.cancel());
    removalAnimation.current = popOutRow(row);
    if (removalAnimation.current) {
      setIsRemovingRow(true);
      try {
        await removalAnimation.current.finished;
      } catch {
        return;
      }
    }

    rowPositions.current = new Map(Array.from(list.querySelectorAll<HTMLElement>('[data-item-key]'), element => [
      element.dataset.itemKey!, element.getBoundingClientRect(),
    ]));
    focusAfterRemoval.current = index;
    removalAnimation.current = null;
    setShoppinglist(items => items.filter(value => value !== item));
    setIsRemovingRow(false);
  }

  function handleCheck(index: number, checked: boolean) {
    const newList = shoppingList.map((item, itemIndex) =>
      itemIndex === index ? updateItem(item, { checked }) : item
    );

    setShoppinglist(newList);
  }

  function updateItem(item: ShoppingListItem, changes: Partial<ShoppingListItem>) {
    const updated = { ...item, ...changes };
    const key = itemKeys.current.get(item);
    if (key)
      itemKeys.current.set(updated, key);

    return updated;
  }

  function moveItem(source: number, target: number, after: boolean, landing?: DOMRect) {
    if (!isEditing || isBusy || newItem !== null)
      return;

    const positions = new Map<string, DOMRect>();
    shoppingListRef.current?.querySelectorAll<HTMLElement>('[data-item-key]').forEach(row => {
      positions.set(row.dataset.itemKey!, row.getBoundingClientRect());
      row.getAnimations?.().forEach(animation => animation.cancel());
    });
    const sourceKey = itemKeys.current.get(shoppingList[source]);
    if (landing && sourceKey)
      positions.set(sourceKey, landing);

    rowPositions.current = positions;
    setShoppinglist(items => {
      const result = reorderItems(items, source, target, after, categories ? itemCategory(items[target]) : undefined);
      const movedIndex = source === target ? source : target - Number(source < target) + Number(after);
      const key = itemKeys.current.get(items[source]);
      if (key)
        itemKeys.current.set(result[movedIndex], key);

      return result;
    });
    setMoveMessage(`Moved ${shoppingList[source].name}${categories ? ` to ${itemCategory(shoppingList[target])}` : ''}.`);
  }

  const displayItems = shoppingList.map((item, index) => ({ item, index, category: itemCategory(item) }));
  if (categories) {
    displayItems.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
  }

  return (
    <Container className="app-shell">
      <Row>
        <Col>
          {storageError && <p role="alert">{storageError}</p>}
          {storageError && !isEditing && <Button variant="outline-primary" onClick={() => setSaveRetry(value => value + 1)}>Retry save</Button>}
            <Row ref={motionRef} className="workspace g-4">
              <Col xs={12} className="list-heading">
                <div className="list-title">
                  <small>HandyList {appVersion} / {isNew ? 'New list' : 'Shopping list'}</small>
                  {isEditing ? <><label htmlFor="list-name">List name</label>
                    <input id="list-name" className="form-control" value={name} maxLength={256} onChange={e => setName(e.target.value)} disabled={isBusy} />
                    <small>{name.length}/256</small></> : <h3>{name}</h3>}
                </div>
              </Col>
              <Col xs={12} className="d-flex align-items-center justify-content-between gap-2">
                <label className="d-inline-flex align-items-center gap-2 py-2">
                  <input type="checkbox" checked={categories} disabled={isBusy || (!isNew && isEditing) || newItem !== null}
                    onChange={e => {
                      revealCategories.current = true;
                      setCategories(e.target.checked);
                    }} />
                  Categorise
                </label>
                {!isEditing && <button type="button" className="edit-list-icon" aria-label="Edit" title="Edit list" onClick={() => void changeEditing(true)} disabled={isBusy || newItem !== null}>
                  <EditIcon width="18" height="18" aria-hidden="true" />
                </button>}
              </Col>
              {image && <Col xs={12}>
                <AnimatedDetails className="source-photo">
                  <summary>
                    <img src={imageUrl || undefined} className="uploaded-image" alt={imageFileName || 'Uploaded shopping list'} />
                    <span className="source-photo-label"><strong>Uploaded photo</strong><small>{imageFileName || 'View photo'}</small></span>
                    <svg className="source-photo-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                  </summary>
                  <img src={imageUrl || undefined} className="source-photo-full" alt="Full source photo" />
                </AnimatedDetails>
              </Col>}

              <Col xs={12} className="shopping-list-panel" role="region" aria-label="Shopping list" aria-busy={isBusy}>
                <p className="visually-hidden" aria-live="polite" aria-atomic="true">{moveMessage}</p>
                <div className={`shopping-list${isEditing ? ' shopping-list-editing' : ''}${shoppingList.length === 0 && newItem === null ? ' shopping-list-empty' : ''}`} ref={shoppingListRef} tabIndex={0} inert={blocksInput || (isSaving && newItem === null)}>
                  {shoppingList.length > 0 &&
                    <>
                      {displayItems.map(({ item, index, category }, position) => {
                        let key = itemKeys.current.get(item);
                        if (!key) {
                          key = crypto.randomUUID();
                          itemKeys.current.set(item, key);
                        }

                        return (
                          <Fragment key={key}>
                          {categories && (position === 0 || displayItems[position - 1].category !== category) && <h4 className="mt-3 mb-2">{category}</h4>}
                          <div data-item-index={index} data-item-key={key} className={isEditing ? "item-editor" : "checkbox-wrapper-52"}>
                            {isEditing && <DragHandle name={item.name || `item ${index + 1}`} disabled={isBusy || newItem !== null}
                              onDrop={({ index: target, after, landing }) => moveItem(index, target, after, landing)}
                              onStep={direction => {
                                const target = displayItems[position + direction];
                                if (target)
                                  moveItem(index, target.index, direction > 0);
                              }} />}
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
                                enterKeyHint="next"
                                autoComplete="off"
                                value={item.name}
                                onChange={e => setShoppinglist(items => items.map((value, position) => position === index ? updateItem(value, { name: e.target.value }) : value))}
                                onBlur={e => {
                                  if (newItemKeys.current.delete(key!) && !e.currentTarget.value.trim()) {
                                    setShoppinglist(items => items.filter(value => itemKeys.current.get(value) !== key));
                                    setEditingItem(null);
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.repeat) {
                                    e.preventDefault();
                                    if (item.name.trim())
                                      addItem();
                                  }
                                }}
                              />
                              <Button variant="outline-danger" aria-label={`Remove item ${index + 1}`} onClick={() => void removeItem(index)} disabled={isBusy}>&#215;</Button>
                            </>}
                          </div></Fragment>);
                      })}
                    </>
                  }

                  {shoppingList.length === 0 && newItem === null && <div className="empty-list-splash">
                    <EmptyListIllustration />
                    <h4>Handy List</h4>
                    <p>No items yet, tap + to add one</p>
                  </div>}
                  {newItem !== null && <div className="item-editor">
                    <input autoFocus className="form-control" aria-label="New item name" enterKeyHint="next" autoComplete="off" value={newItem} onChange={e => setNewItem(e.target.value)} onBlur={e => {
                      if (!e.currentTarget.value.trim())
                        setNewItem(null);
                    }} onKeyDown={e => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.repeat) {
                        e.preventDefault();
                        confirmNewItem(true);
                      }

                      if (e.key === 'Escape') {
                        setNewItem(null);
                      }
                    }} />
                    <Button variant="outline-success" aria-label="Confirm new item" onClick={() => confirmNewItem()} disabled={!newItem.trim() || blocksInput}>&#10003;</Button>
                    <Button variant="outline-danger" aria-label="Cancel new item" onClick={() => setNewItem(null)}>&#215;</Button>
                  </div>}
                  <div className="list-actions">
                    <button type="button" className="add-item-button" aria-label="Add item" onClick={addItem} disabled={isBusy || newItem !== null}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14 M5 12h14" />
                      </svg>
                      Add item
                    </button>
                    <input ref={inputFileButtonRef} type="file" id="upload" accept="image/jpeg, image/jpg, image/png, image/webp, image/gif" onChange={handleImageUpload} hidden disabled={!client || isBusy || !!image || newItem !== null} />
                    <button type="button" className="add-item-button" aria-label="Photo" onClick={() => inputFileButtonRef.current?.click()} disabled={!client || isBusy || !!image || newItem !== null}>
                      <PhotoIcon aria-hidden="true" />
                      Photo
                    </button>
                  </div>
                </div>
                {(isLoading || isPreparingImage) && <div className="list-loading-overlay" role="status">
                  <Spinner animation="border" aria-hidden="true" />
                  <span className="visually-hidden">{isLoading ? 'Processing image' : 'Preparing image'}</span>
                </div>}
              </Col>
            </Row>

        </Col>
      </Row>

        <div className="navbar-dock" ref={navbarRef}>
        <Navbar className="app-nav-bar" aria-label="List actions">
          <button aria-label="Back" className="nav-button" onClick={onBack} disabled={isBusy || isEditing || newItem !== null || !!storageError}>
            <LeftIcon aria-hidden="true" />
            <span>Back</span>
          </button>
          {isEditing && <>
            <button aria-label="Cancel" className="nav-button" onClick={() => void changeEditing(false)} disabled={isBusy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12 M18 6 6 18" /></svg>
              <span>Cancel</span>
            </button>
            <button aria-label="Save" className="nav-button nav-save" onClick={() => void changeEditing(false, true)} disabled={isBusy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
              <span>Save</span>
            </button>
          </>}
          {!isNew && <button aria-label="Clear" className="nav-button nav-clear" onClick={() => void handleClear()} disabled={isBusy || isEditing}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m16 3 5 5-12 12H5l-3-3L16 3Z" />
              <path d="m7 12 7 7M12 21h9" />
            </svg>
            <span>Clear</span>
          </button>}
          {!isNew && <button aria-label="Delete" className="nav-button nav-clear" onClick={() => onDelete({ ...initial, name })} disabled={isBusy || isEditing || newItem !== null || !!storageError}>
            <TrashIcon aria-hidden="true" />
            <span>Delete</span>
          </button>}
        </Navbar>
        </div>
    </Container>
  );
}

function failureReason(error: unknown): string {
  if (isStorageFull(error))
    return 'Browser storage is full. Free some storage and retry.';

  return error instanceof Error ? error.message : String(error);
}

export default ListEditor;
