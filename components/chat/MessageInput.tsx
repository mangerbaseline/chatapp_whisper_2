"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Loader2,
  Paperclip,
  X,
  File as FileIcon,
  Film,
  Smile,
  Coins,
  Mic,
  MicOff,
  Square,
  Trash2,
  Sparkles,
} from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import SendTokensModal from "./SendTokensModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import axios from "axios";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
interface MessageInputProps {
  conversationId: string;
  onSendMessage: (text: string, attachments?: any[]) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  recipientId?: string;
  recipientName?: string;
  isSupportChat?: boolean;
}

export default function MessageInput({
  conversationId,
  onSendMessage,
  onTyping,
  recipientId,
  recipientName,
  isSupportChat,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<
    { url: string; type: string; name: string }[]
  >([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

  // Voice Recording and Dictation States & Refs
  const [isRecording, setIsRecording] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any | null>(null);

  const SpeechRecognition = typeof window !== "undefined"
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as any
    : null;

  const startDictation = () => {
    if (!SpeechRecognition) {
      toast.error("Speech Recognition is not supported in this browser.");
      return;
    }
    if (isRecording) {
      stopRecording();
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsDictating(true);
      toast.info("Dictation started. Speak now...");
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setMessage((prev) => (prev ? prev + " " + finalTranscript : finalTranscript));
        onTyping(true);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition error", event.error);
      setIsDictating(false);
    };

    recognition.onend = () => {
      setIsDictating(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsDictating(false);
    toast.success("Dictation stopped.");
  };

  const startRecording = async () => {
    try {
      if (isDictating) {
        stopDictation();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });

        setSelectedFiles((prev) => [...prev, audioFile]);
        setPreviews((prev) => [
          ...prev,
          {
            url: URL.createObjectURL(audioBlob),
            type: "audio/webm",
            name: audioFile.name,
          },
        ]);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording", err);
      toast.error("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        const stream = mediaRecorderRef.current?.stream;
        stream?.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    toast.info("Recording cancelled.");
  };

  const handleTranscribePreview = async (index: number) => {
    const file = selectedFiles[index];
    if (!file) return;

    setIsTranscribing(true);
    const toastId = toast.loading("Transcribing audio...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post("/api/transcribe", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data?.success && res.data?.text) {
        setMessage((prev) => (prev ? prev + " " + res.data.text : res.data.text));
        toast.success("Transcription complete!", { id: toastId });
      } else {
        toast.error("Failed to transcribe audio.", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
        "Failed to transcribe audio. Make sure OPENAI_API_KEY is configured in .env",
        { id: toastId }
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    onTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...files]);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [
          ...prev,
          {
            url: reader.result as string,
            type: file.type,
            name: file.name,
          },
        ]);
      };
      if (file.type.startsWith("image/")) {
        reader.readAsDataURL(file);
      } else {
        setPreviews((prev) => [
          ...prev,
          {
            url: URL.createObjectURL(file),
            type: file.type,
            name: file.name,
          },
        ]);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const onEmojiClick = (emojiData: any) => {
    setMessage((prev) => prev + emojiData.emoji);
    onTyping(true);
  };

  const handleSend = async () => {
    if ((!message.trim() && selectedFiles.length === 0) || isLoading) return;

    setIsLoading(true);
    try {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        onTyping(false);
      }

      let attachments: any[] = [];

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });

        const uploadRes = await axios.post(
          `/api/upload?conversationId=${conversationId}`,
          formData,
        );
        attachments = uploadRes.data.data;
      }

      await onSendMessage(message, attachments);

      setMessage("");
      setSelectedFiles([]);
      setPreviews([]);
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-background/40 backdrop-blur-md border border-border/40 rounded-xl overflow-x-auto max-h-32">
          {previews.map((preview, index) => (
            <div
              key={index}
              className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border/50 bg-background/50"
            >
              {preview.type.startsWith("image/") ? (
                <img
                  src={preview.url}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              ) : preview.type.startsWith("video/") ? (
                <div className="w-full h-full flex items-center justify-center bg-primary/10">
                  <Film className="h-8 w-8 text-primary" />
                </div>
              ) : preview.type.startsWith("audio/") ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-1 text-[10px] text-center bg-primary/5">
                  <Mic className="h-5 w-5 text-primary mb-0.5" />
                  <span className="truncate w-full text-[9px] mb-1">{preview.name}</span>
                  <button
                    type="button"
                    onClick={() => handleTranscribePreview(index)}
                    className="px-1.5 py-0.5 bg-primary/20 hover:bg-primary/35 text-[9px] rounded-md transition-all duration-200 flex items-center gap-0.5 text-primary font-medium"
                    disabled={isTranscribing}
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    Transcribe
                  </button>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-1 text-[10px] text-center">
                  <FileIcon className="h-8 w-8 text-muted-foreground mb-1" />
                  <span className="truncate w-full">{preview.name}</span>
                </div>
              )}
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 p-0.5 bg-background/80 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-background/60 backdrop-blur-xl border border-border/40 rounded-2xl p-2 shadow-sm transition-all duration-300 focus-within:shadow-md focus-within:bg-background/80">
        {isRecording ? (
          <div className="flex items-center justify-between w-full h-10 px-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-500">Recording: {formatDuration(recordingDuration)}</span>
              <div className="flex gap-0.5 items-center ml-2">
                <span className="h-2 w-0.5 bg-red-500/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-3.5 w-0.5 bg-red-500/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-0.5 bg-red-500/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={cancelRecording}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={stopRecording}
                className="h-8 px-3 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Square className="h-3.5 w-3.5 fill-white text-white border-none" />
                Stop
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col w-full">
            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <Textarea
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={isDictating ? "Listening..." : "Type a message..."}
              className="min-h-[44px] max-h-[150px] resize-none border-0 focus-visible:ring-0 bg-transparent py-3 px-3 shadow-none text-sm placeholder:text-muted-foreground/70 w-full"
              disabled={isLoading}
              rows={1}
              style={{ height: "auto", minHeight: "44px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
              }}
            />

            <div className="flex items-end justify-between px-2 pb-1 pt-1 mt-auto">
              <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-200 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Attach File"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-200 cursor-pointer"
                      disabled={isLoading}
                      title="Add Emoji"
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="p-0 border-none bg-transparent shadow-none w-auto"
                  >
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
                      lazyLoadEmojis={true}
                    />
                  </PopoverContent>
                </Popover>
                
                {recipientId && !isSupportChat && (
                  <SendTokensModal
                    recipientId={recipientId}
                    recipientName={recipientName || "User"}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-200 cursor-pointer"
                      disabled={isLoading}
                      title="Send Tokens"
                    >
                      <Coins className="h-4 w-4" />
                    </Button>
                  </SendTokensModal>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 text-rose-500/80 transition-all duration-200 cursor-pointer"
                  onClick={startRecording}
                  disabled={isLoading}
                  title="Record Voice Message"
                >
                  <Mic className="h-4 w-4" />
                </Button>

                {SpeechRecognition && (
                  <Button
                    type="button"
                    variant={isDictating ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-xl transition-all duration-200 cursor-pointer",
                      isDictating ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" : "hover:bg-violet-500/10 hover:text-violet-500 text-violet-500/80"
                    )}
                    onClick={isDictating ? stopDictation : startDictation}
                    disabled={isLoading}
                    title={isDictating ? "Stop Dictation" : "Voice Dictation (Speech to Text)"}
                  >
                    {isDictating ? <MicOff className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              <Button
                onClick={handleSend}
                disabled={(!message.trim() && selectedFiles.length === 0) || isLoading}
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl transition-all duration-200 cursor-pointer ml-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-0.5" />
                )}
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
