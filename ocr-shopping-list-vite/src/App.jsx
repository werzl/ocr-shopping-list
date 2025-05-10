import { useState } from "react";
import reactLogo from "./assets/react.svg";
import notepadLogo from "./assets/notepad.png";
import OpenAI from "openai";
import "./App.css";

async function recogniseHandwriting(apiKey, imageUrl) {
  try {
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      temperature: 1,
      top_p: 1,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You are an OCR assistant. Only return clean extracted handwritten text, with no formatting or explanation.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract only the handwritten words from this image. Do not include any crossed out words. Only return the words in a comma separated string with no spaces. Replace any commas in the image with full stops.",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    });

    console.log(response.choices[0].message.content);

    return response.choices[0].message.content;

  }
  catch (error) {
    console.error("Error:", error);
  }
}

// Replace with your image URL
// const imageUrl = "https://i.imgur.com/wzYpVgz_d.jpeg";
// await recognizeHandwriting(imageUrl);

function App() {
  //TODO: remove api key
  const [apiKey, setApiKey] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [shoppingList, setShoppinglist] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleProcess() {
    setIsLoading(true);

    const commaSeparated = await recogniseHandwriting(apiKey, imageUrl);
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
