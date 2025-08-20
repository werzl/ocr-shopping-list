import { useState, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";

import notepadLogo from "./assets/notepad.png";
import OpenAiWrapper from "./openai/OpenAiWrapper.js";
//import { recogniseHandwriting } from "../test/openai/openAiWrapperMock";
import "./App.css";

function App() {
  const [base64ImageFileName, setBase64ImageFileName] = useState("");
  const [base64Image, setBase64Image] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [shoppingList, setShoppinglist] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfirmed, setApiKeyConfirmed] = useState(false);

  const shoppingListRef = useRef(null);
  const openAiWrapper = useRef(null);

  async function handleProcess() {
    setIsLoading(true);

    try {
      const commaSeparated = await openAiWrapper.current.recogniseHandwriting(imageUrl);
      const array = commaSeparated.split(',');
      setShoppinglist(array);
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

  function handleImageUpload(e) {
    const file = e.target.files[0];

    try {
      if (!file)
        throw new Error("File was empty");

      const reader = new FileReader();

      reader.onloadend = () => {
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

  function handleCLear() {
    setImageUrl("");
    setShoppinglist([]);
    setBase64ImageFileName("");
    setBase64Image("");
    setIsLoading(false);
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
    handleCLear();
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

  return (
    <>
      <div>
        <a>
          <img src={notepadLogo} className="logo" alt="Notepad logo" />
        </a>
      </div>
      <h2>HandyList 1.2.0</h2>

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
            <div className="file-input">
              <input type="file" id="file" className="file" accept="image/jpeg, image/jpg, image/png, image/webp, image/gif" onChange={handleImageUpload} />
              <label htmlFor="file">
                Upload photo
              </label>
            </div>

            <button className="button-30" onClick={async () => await handleProcess()} disabled={isLoading || !imageUrl} style={{ "width": "100px" }}>
              {!isLoading && "Process"}

              {isLoading && <div className="loader"></div>}
            </button>

            <br /><br />
            <button className="button-30" onClick={() => handleCLear()} disabled={isLoading}>
              Clear
            </button>
          </div>

          {base64Image &&
            <div className="uploaded-image-container">
              <p>{base64ImageFileName}</p>
              <img src={base64Image} className="uploaded-image" />
            </div>
          }

          <div className="shopping-list" ref={shoppingListRef}>
            {shoppingList.map(item => (
              <div className="checkbox-wrapper-52" key={item}>
                <label htmlFor={item} className="item">
                  <input type="checkbox" id={item} className="hidden" />

                  <label htmlFor={item} className="cbx">
                    <svg width="14px" height="12px" viewBox="0 0 14 12">
                      <polyline points="1 7.6 5 11 13 1"></polyline>
                    </svg>
                  </label>

                  <label htmlFor={item} className="cbx-lbl">{item}</label>
                </label>
              </div>
            ))}
          </div>
        </>
      }

      <ToastContainer />

    </>
  );
}

export default App;
