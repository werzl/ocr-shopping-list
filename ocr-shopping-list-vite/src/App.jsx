import { useState } from "react";
import reactLogo from "./assets/react.svg";
import notepadLogo from "./assets/notepad.png";
import { recogniseHandwriting } from "./openai/openAiWrapper.js";
import "./App.css";

// Replace with your image URL
// const imageUrl = "https://i.imgur.com/wzYpVgz_d.jpeg";
// await recognizeHandwriting(imageUrl);

function App() {
  const [imageUrl, setImageUrl] = useState("");
  const [shoppingList, setShoppinglist] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleProcess() {
    setIsLoading(true);

    const commaSeparated = await recogniseHandwriting(imageUrl);
    const array = commaSeparated.split(',');

    setShoppinglist(array);
    setIsLoading(false);
  }

  function handleCLear() {
    setImageUrl("");
    setShoppinglist([]);
  }

  return (
    <>
      <div>
        <a href="" target="_blank">
          <img src={notepadLogo} className="logo" alt="Notepad logo" />
        </a>
      </div>
      <h1>HandyList 1.0</h1>
      <div className="card">
        <input type="text" placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value )} />

        <br /><br />
        <button onClick={() => handleProcess()}>
          Process
        </button>

        <br /><br />
        <button onClick={() => handleCLear()}>
          Clear
        </button>
      </div>

      <div style={{textAlign: "center"}}>
        {!isLoading && <>
            <a href="" target="_blank">
              <img src={reactLogo} className="logo react" alt="React logo" />
            </a>
          </>}

          {isLoading && <>
            <a href="" target="_blank">
              <img src={reactLogo} className="logo logo-spin react" alt="React logo" />
            </a>
          </>}
      </div>

      <div style={{textAlign: "left"}}>
          {shoppingList.map(item => (
            <p><input style={{width: "100%"}} type="checkbox"  value={item} /> {item}</p>
          ))}
      </div>
    </>
  );
}

export default App;
