import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { ToastContainer, toast } from "react-toastify";
import { Container, Row, Col, Card, Navbar, Button } from "react-bootstrap";

import notepadLogo from "./assets/notepad.png";
import OpenAiWrapper from "./openai/OpenAiWrapper";
import LeftIcon from "./assets/arrow-left-solid-full.svg?react";
import PhotoIcon from "./assets/photo-film-solid-full.svg?react";
import PlayIcon from "./assets/play-solid-full.svg?react";
import TrashIcon from "./assets/trash-solid-full.svg?react";
import PinchIcon from "./assets/pinch-to-zoom.svg?react";

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
  const [imageFileName, setImageFileName] = useState('');
  const [image, setImage] = useState<Blob | null>(null);
  const originalImage = useRef<File | null>(null);
  const savedImage = useRef<Blob | null>(null);
  const [shoppingList, setShoppinglist] = useState<ShoppingListItem[]>([]);
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
    if (!storageReady)
      return;

    const version = ++saveVersion.current;
    setIsSaving(true);
    const session = { id: 'current' as const, shoppingList, ...(image ? { imageId: 'current' as const } : {}), fileName: imageFileName };
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
  }, [storageReady, shoppingList, image, imageFileName, saveRetry]);

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
      if ((image && shoppingList.length === 0) || isPreparingImage || isSaving || (storageReady && storageError)) {
        e.preventDefault();
        e.returnValue = true;
      }
    }

    window.addEventListener('beforeunload', beforeunload);

    return () => {
      window.removeEventListener('beforeunload', beforeunload);
    }
  }, [image, shoppingList.length, isPreparingImage, isSaving, storageReady, storageError]);

  async function processImage() {
    if (!openAiWrapper.current || !image) {
      return;
    }

    setIsLoading(true);

    try {
      const commaSeparated = await openAiWrapper.current.recogniseHandwriting(await imageToDataUrl(originalImage.current ?? image));
      const array = commaSeparated.split(',');
      const shoppingListObjects = array.map((v) => {
        return {
          name: v,
          checked: false
        }
      });

      setShoppinglist(shoppingListObjects);
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
    if (!file)
      return;

    // Clear the file input so that the same file can be uploaded again if needed without having to manually clear the input
    if (inputFileButtonRef.current) {
      inputFileButtonRef.current.value = "";
    }

    setIsPreparingImage(true);
    try {
      const compressed = await compressImage(file);
      originalImage.current = file;
      setShoppinglist([]);
      setImageFileName(file.name);
      setImage(compressed);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : 'Could not prepare this image. Try a different photo.');
    } finally {
      setIsPreparingImage(false);
    }
  }

  function handleClear() {
    originalImage.current = null;
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

  return (
    <Container className="app-shell">
        <Row>
          <Col>
            <div>
                <h2 className="app-heading"><img src={notepadLogo} className="logo" alt="Notepad logo" /> HandyList {appVersion}</h2>
            </div>

            {isPreparingImage && <p role="status">Preparing image...</p>}
            {storageError && <p role="alert">{storageError}</p>}
            {storageError && storageReady && <Button onClick={() => setSaveRetry(value => value + 1)}>Retry save</Button>}
            {!storageReady && !storageError && <p role="status">Loading saved list...</p>}
            {!apiKeyConfirmed &&
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
            }

            {apiKeyConfirmed &&
              <Row className="workspace g-4">
                {image &&
                  <Col xs={12} lg={6} className="uploaded-image-container">
                    <p><img src={imageUrl || undefined} className="uploaded-image" alt={imageFileName || "Uploaded shopping list"} /> <small className="zoom-hint d-lg-none fw-lighter fst-italic">Zoom in to see me! <PinchIcon /></small></p>

                  </Col>
                }

                <Col xs={12} lg={image ? 6 : 12} className="shopping-list" ref={shoppingListRef} role="region" aria-label="Shopping list" tabIndex={0}>
                  {shoppingList.length > 0 &&
                    <>
                      {shoppingList.map((item, index) => {
                        const key = `shopping-item-${index}`;

                        return (
                          <div className="checkbox-wrapper-52" key={key + "-" + item.name}>
                            <label htmlFor={String(key)} className="item">
                              <input type="checkbox" id={String(key)} className="hidden" checked={item.checked} onChange={(e) => handleCheck(index, e.target.checked)} />

                              <span className="cbx" aria-hidden="true">
                                <svg width="14px" height="12px" viewBox="0 0 14 12">
                                  <polyline points="1 7.6 5 11 13 1"></polyline>
                                </svg>
                              </span>

                              <span className="cbx-lbl">{item.name}</span>
                            </label>
                          </div>);
                      })}
                    </>
                  }

                  {shoppingList.length === 0 && !image &&
                    <Card bg="light" text="dark" className="empty-list text-start">
                      <Card.Header className="border-bottom">Upload an image</Card.Header>
                      <Card.Body>
                        <Card.Text>
                          No items found. Upload an image of a handwritten shopping list and hit "Process" to generate a list.
                        </Card.Text>
                      </Card.Body>
                    </Card>
                  }
                </Col>
              </Row>
            }

            <ToastContainer />
          </Col>
        </Row>

      {apiKeyConfirmed &&
        <Navbar fixed="bottom" className="app-nav-bar justify-content-center">
          <Row>
            <Col>
              <button aria-label="Back" className="nav-button" onClick={() => handleBack()} disabled={isBusy}>
                <LeftIcon />
              </button>

              <small>Back</small>
            </Col>

            <Col>
              <input ref={inputFileButtonRef} type="file" id="upload" accept="image/jpeg, image/jpg, image/png, image/webp, image/gif" onChange={handleImageUpload} style={{ display: "none" }} disabled={isLoading} />
              <button className="nav-button upload-button" aria-label="Upload" onClick={() => inputFileButtonRef.current?.click()} disabled={isBusy}>
                <PhotoIcon />
              </button>
              <small>Upload</small>
            </Col>

            <Col>
              <button aria-label="Process" className={`nav-button ${isLoading ? "loading" : ""}`} onClick={async () => await processImage()} disabled={isBusy || shoppingList.length > 0 || !imageUrl}>
                {!isLoading && <PlayIcon />}
                {isLoading && <div className="loader"></div>}
              </button>

              <small>Process</small>
            </Col>

            <Col>
              <button aria-label="Clear" className="nav-button" onClick={() => handleClear()} disabled={isLoading}>
                <TrashIcon />
              </button>

              <small>Clear</small>
            </Col>
          </Row>
        </Navbar>
      }
    </Container>
  );
}

export default App;
