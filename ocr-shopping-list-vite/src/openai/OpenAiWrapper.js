import OpenAI from "openai";

const _apiKey = import.meta.env.VITE_OpenAI_Api_Key;

export default class OpenAIWrapper {
    #openai = null;

    constructor(apiKey) {
        if (!_apiKey && !apiKey) {
            throw new Error("Api Key was not set");
        }

        this.#openai = new OpenAI({
            apiKey: _apiKey ?? apiKey,
            dangerouslyAllowBrowser: true,
        });
    }

    async recogniseHandwriting(imageUrl) {
        console.log("Making request to Open AI...");

        const response = await this.#openai.chat.completions.create({
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

        console.log("Successfully processed OpenAI request");

        return response.choices[0].message.content;
    }
}