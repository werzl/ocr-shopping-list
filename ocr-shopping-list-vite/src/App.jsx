import { useState, useRef } from "react";
import notepadLogo from "./assets/notepad.png";
import { recogniseHandwriting } from "./openai/openAiWrapper.js";
//import { recogniseHandwriting } from "../test/openai/openAiWrapperMock";
import "./App.css";

function App() {
  const [base64ImageFileName, setBase64ImageFileName] = useState("");
  const [base64Image, setBase64Image] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [shoppingList, setShoppinglist] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const shoppingListRef = useRef(null);

  async function handleProcess() {
    setIsLoading(true);

    console.log(`base64 image: ${base64Image}`);
    const commaSeparated = await recogniseHandwriting(imageUrl);
    const array = commaSeparated.split(',');

    setShoppinglist(array);
    setIsLoading(false);

    shoppingListRef.current.scrollIntoView({ behaviour: "smooth" });
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
    }
  }

  function handleCLear() {
    setImageUrl("");
    setShoppinglist([]);
    setBase64ImageFileName("");
    setBase64Image("");
    setIsLoading(false);
  }

  return (
    <>
      <div>
        <a>
          <img src={notepadLogo} className="logo" alt="Notepad logo" />
        </a>
      </div>
      <h2>HandyList 1.1.0</h2>
      <div className="card">
        <div className="file-input">
          <input type="file" id="file" className="file" accept="image/jpeg, image/jpg, image/png, image/webp, image/gif" onChange={handleImageUpload} />
          <label htmlFor="file">
            Upload photo
          </label>
        </div>

        <button className="button-30" onClick={async () => await handleProcess()} disabled={isLoading} style={{"width": "100px"}}>
          {!isLoading && "Process" }

          {isLoading && <div className="loader"></div> }
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
          <>
            <div className="checkbox-wrapper-52" key={item}>
              <label htmlFor={item} className="item">
                <input type="checkbox" id={item} className="hidden"/>

                <label htmlFor={item} className="cbx">      
                  <svg width="14px" height="12px" viewBox="0 0 14 12">
                    <polyline points="1 7.6 5 11 13 1"></polyline>
                  </svg>
                </label>

                <label htmlFor={item} className="cbx-lbl">{item}</label>
              </label>
            </div>
          </>
        ))}
      </div>
    </>
  );
}

export default App;
