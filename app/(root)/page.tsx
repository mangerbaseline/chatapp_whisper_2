"use client";

import ChatWindow from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/PageHeader";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { MessageSquare } from "lucide-react";

export default function MessagesPage() {
  const selectedConversationId = useSelector(
    (state: RootState) => state.chat.selectedConversationId,
  );

  return (
    <div className="flex-1 flex flex-col md:min-h-min h-full relative overflow-hidden font-geist-sans">
      {selectedConversationId ? (
        <ChatWindow conversationId={selectedConversationId} />
      ) : (
        <>
          <PageHeader
            title="Messages"
            description="Select a conversation to start chatting."
            icon={<MessageSquare className="h-4 w-4 text-primary" />}
          />
          <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-4">
            <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-base font-semibold text-foreground">
              Select a conversation
            </p>
            <p className="text-xs text-muted-foreground/60 max-w-xs text-center">
              Choose a contact from the sidebar or start a new chat to begin
              communicating.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
