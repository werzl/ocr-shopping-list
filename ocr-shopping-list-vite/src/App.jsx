import { useState, useRef, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";

import notepadLogo from "./assets/notepad.png";
import placeholder from "./assets/placeholder.png";
import OpenAiWrapper from "./openai/OpenAiWrapper.js";
//import { recogniseHandwriting } from "../test/openai/openAiWrapperMock";
import "./App.css";

const shoppingListStorageKey = "shoppingList";
const base64ImageStorageKey = "base64Image";
const placeholderStorageValue = "placeholder";
const base64FileNameStorageKey = "base64FileName";

function App() {
  const [base64ImageFileName, setBase64ImageFileName] = useState(() => {
    const storageFileName = localStorage.getItem(base64FileNameStorageKey);
    return storageFileName ? storageFileName : "";
  });

  const [base64Image, setBase64Image] = useState(() => {
    const storageImage = localStorage.getItem(base64ImageStorageKey);
    return storageImage ? storageImage : "";
  });

  const [shoppingList, setShoppinglist] = useState(() => {
    const storageShoppingList = localStorage.getItem(shoppingListStorageKey);
    return storageShoppingList ? JSON.parse(storageShoppingList) : [];
  });

  const [imageUrl, setImageUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfirmed, setApiKeyConfirmed] = useState(false);

  const shoppingListRef = useRef(null);
  const openAiWrapper = useRef(null);

  useEffect(() => {
    localStorage.setItem(shoppingListStorageKey, JSON.stringify(shoppingList));
  }, [shoppingList]);

  useEffect(() => {
    try {
      localStorage.setItem(base64ImageStorageKey, base64Image);
    }
    catch (e) {
      console.error(e);
      localStorage.setItem(base64ImageStorageKey, placeholderStorageValue);
    }
  }, [base64Image]);

  useEffect(() => {
    localStorage.setItem(base64FileNameStorageKey, base64ImageFileName)
  }, [base64ImageFileName]);

  useEffect(() => {
    function beforeunload(e) {
      if (imageUrl && shoppingList.length === 0) {
        e.preventDefault();
        e.returnValue = true;
        window.confirm();
      }
    }

    window.addEventListener('beforeunload', beforeunload);

    return () => {
      window.removeEventListener('beforeunload', beforeunload);
    }
  }, [imageUrl, shoppingList]);

  async function processImage() {
    setIsLoading(true);

    try {
      const commaSeparated = await openAiWrapper.current.recogniseHandwriting(imageUrl);
      const array = commaSeparated.split(',');
      var shoppingListObjects = array.map((v) => {
        return {
          name: v,
          checked: false
        }
      });

      setShoppinglist(shoppingListObjects);
      setIsLoading(false);

      shoppingListRef.current.scrollIntoView({ behaviour: "smooth" });
    }
    catch (e) {
      console.error(e);

      if (e.message.toLowerCase().includes("401")) {
        errorToast("Invalid API Key");
      }
      else {
        errorToast("Processing error");
      }

      setIsLoading(false);
    }
  }

  async function handleImageUpload(e) {
    handleClear();

    const file = e.target.files[0];

    try {
      if (!file)
        throw new Error("File was empty");

      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64String = `data:${file.type};base64,${reader.result.split(",")[1]}`;
        setBase64ImageFileName(file.name);
        setBase64Image(reader.result);
        setImageUrl(base64String);
      };

      reader.readAsDataURL(file);

    }
    catch (e) {
      console.error(e);
      errorToast("Error with image upload");
    }
  }

  function handleClear() {
    setImageUrl("");
    setShoppinglist([]);
    setBase64ImageFileName("");
    setBase64Image("");
    setIsLoading(false);
    localStorage.removeItem(shoppingListStorageKey);
  }

  function handleApiKeyConfirmation() {
    try {

      openAiWrapper.current = new OpenAiWrapper(apiKey);
      setApiKeyConfirmed(true);
    }
    catch (e) {
      console.error(e);
      errorToast("API Key not set");
    }
  }

  function handleBack() {
    handleClear();
    setApiKey("");
    setApiKeyConfirmed(false);
  }

  function errorToast(message) {
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

  function handleCheck(name, checked) {
    var newList = shoppingList.map(item =>
      item.name === name ? { ...item, checked } : item
    );

    setShoppinglist(newList);
  }

  return (
    <>
      <div>
        <a>
          <img src={notepadLogo} className="logo" alt="Notepad logo" />
        </a>
      </div>
      <h2>HandyList 1.3.1</h2>

      {!apiKeyConfirmed &&
        <div className="div">
          <form className="w-25 mt-3 text-center" >
            <label htmlFor="apiKey">Enter an API Key</label>
            <br />
            <input type="password" id="apiKey" placeholder="API-Key" onChange={e => setApiKey(e.target.value)} style={{ "width": "400px" }} />
            <br /><br />
            <button type="button" className="button-30" onClick={() => handleApiKeyConfirmation()}>
              Submit
            </button>
          </form>
        </div>
      }

      {apiKeyConfirmed &&
        <>
          <div className="card">
            <button className="button-30 dark" onClick={() => handleBack()} disabled={isLoading}>
              {"<"} Back
            </button>

            <br /><br />

            <input type="file" id="upload" accept="image/jpeg, image/jpg, image/png, image/webp, image/gif" onChange={handleImageUpload} style={{display: "none"}} disabled={isLoading}/>
            <label htmlFor="upload" className="button-30 upload" disabled={isLoading}>
              Upload Photo
            </label>

            <br /><br />

            <button className={`button-30 ${isLoading ? "loading" : ""}`} onClick={async () => await processImage()} disabled={isLoading || shoppingList.length > 0 || !imageUrl} style={{ "width": "100px" }}>
              {!isLoading && "Process"}


              {isLoading && <div className="loader"></div>}
            </button>

            <br /><br />

            <button className="button-30" onClick={() => handleClear()} disabled={isLoading}>
              Clear
            </button>
          </div>

          {base64Image &&
            <div className="uploaded-image-container">
              <p>{base64ImageFileName}</p>
              <img src={base64Image === placeholderStorageValue ? placeholder : base64Image} className="uploaded-image" />
            </div>
          }

          <div className="shopping-list" ref={shoppingListRef}>
            {shoppingList.length > 0 &&
              <>
                {shoppingList.map(item => {
                  let key = Math.random();

                  return (
                    <div className="checkbox-wrapper-52" key={key}>
                      <label htmlFor={key} className="item">
                        <input type="checkbox" id={key} className="hidden" checked={item.checked} onChange={(e) => handleCheck(item.name, e.target.checked)} />

                        <label htmlFor={key} className="cbx">
                          <svg width="14px" height="12px" viewBox="0 0 14 12">
                            <polyline points="1 7.6 5 11 13 1"></polyline>
                          </svg>
                        </label>

                        <label htmlFor={key} className="cbx-lbl">{item.name}</label>
                      </label>
                    </div>);
                })}
              </>
            }
          </div>
        </>
      }

      <ToastContainer />

    </>
  );
}

export default App;
