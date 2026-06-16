import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ message: "Missing file" }, { status: 400 });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      return NextResponse.json({
        message: "Whisper API transcription is not configured (missing OPENAI_API_KEY)",
        success: false,
      }, { status: 400 });
    }

    const openAiFormData = new FormData();
    openAiFormData.append("file", file);
    openAiFormData.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      openAiFormData,
      {
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return NextResponse.json({
      success: true,
      text: response.data.text,
    });
  } catch (error: any) {
    console.error("Transcription API Error:", error.response?.data || error.message);
    return NextResponse.json(
      { message: "Transcription failed", error: error.message },
      { status: 500 }
    );
  }
}
