import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function generateAIResponse(messages: AiMessage[]) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    console.warn("OPENROUTER_API_KEY is missing from environment variables.");
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  try {
    const modelId = "openrouter/free";

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: modelId,
        messages: messages,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Chat App",
        },
      },
    );

    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0
    ) {
      return response.data.choices[0].message.content;
    } else {
      console.error("Unexpected OpenRouter response structure:", response.data);
      throw new Error("Invalid response from AI provider.");
    }
  } catch (error: any) {
    console.error("OpenRouter Error:", error.response?.data || error.message);
    throw new Error("Failed to get AI response from OpenRouter.");
  }
}
