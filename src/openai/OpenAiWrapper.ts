import OpenAI from "openai";

export default class OpenAIWrapper {
    #openai: OpenAI;

    constructor(apiKey?: string) {
        if (!apiKey) {
            throw new Error("Api Key was not set");
        }

        this.#openai = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true,
        });
    }

    async recogniseHandwriting(imageUrl: string): Promise<string> {
        console.log("Making request to Open AI...");

        const response = await this.#openai.chat.completions.create({
            model: "gpt-4.1",
            temperature: 1,
            top_p: 1,
            max_completion_tokens: 2048,
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

        return response.choices[0].message.content ?? "";
    }

    async testApiKey() {
        console.log("Testing API Key...");

        const response = await this.#openai.models.list();

        console.log("API Key Valid");

        return response.data;
    }
}
