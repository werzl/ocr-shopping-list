import OpenAI from "openai";

const _apiKey = import.meta.env.VITE_OpenAI_Api_Key;

const openai = new OpenAI({
    apiKey: _apiKey,
    dangerouslyAllowBrowser: true,
});

export async function recogniseHandwriting(imageUrl) {
    try {
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