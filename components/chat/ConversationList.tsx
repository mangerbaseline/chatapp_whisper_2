"use client";

import { useEffect } from "react";
import { useSocket } from "@/components/SocketProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  fetchConversations,
  updateConversation,
  incrementUnreadCount,
} from "@/redux/features/chat/chatSlice";
import type { Conversation, Message } from "@/redux/features/chat/chatSlice";
import { MessageSquare, Users } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter, usePathname } from "next/navigation";

interface ConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

const gradients = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-orange-400 to-rose-500",
  "from-pink-500 to-fuchsia-500",
  "from-indigo-500 to-blue-600",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-500",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

function formatTime(dateString?: string) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);

    if (diffHrs < 1) {
      const mins = Math.floor(diffMs / (1000 * 60));
      return mins <= 0 ? "now" : `${mins}m`;
    }
    if (diffHrs < 24)
      return formatDistanceToNowStrict(date, { addSuffix: false })
        .replace(" hours", "h")
        .replace(" hour", "h")
        .replace(" minutes", "m")
        .replace(" minute", "m");
    if (diffHrs < 168)
      return date.toLocaleDateString(undefined, { weekday: "short" });
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ConversationList({
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const dispatch = useAppDispatch();
  const conversations = useAppSelector(
    (state) => state.chat.conversations,
  ).filter((c) => !c.isSupportTicket);
  const { socket, isConnected, onlineUsers } = useSocket();
  const currentUser = useAppSelector((state) => state.auth.user);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    dispatch(fetchConversations());

    const handleConversationUpdated = (conversation: Conversation) => {
      dispatch(updateConversation(conversation));
    };

    const handleNewConversation = (conversation: Conversation) => {
      dispatch(updateConversation(conversation));
    };

    socket.on("conversation_updated", handleConversationUpdated);
    socket.on("new_conversation", handleNewConversation);

    return () => {
      socket.off("conversation_updated", handleConversationUpdated);
      socket.off("new_conversation", handleNewConversation);
    };
  }, [socket, isConnected, dispatch, selectedConversationId]);

  const getOtherParticipant = (conversation: Conversation) => {
    if (!currentUser) return conversation.participants[0];
    return (
      conversation.participants.find((p) => p._id !== currentUser._id) ||
      conversation.participants[0]
    );
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 mb-3">
          <MessageSquare className="h-5 w-5 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-muted-foreground/80">
          No conversations yet
        </p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Search users to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2">
      {conversations.map((conversation) => {
        const otherUser = getOtherParticipant(conversation);
        const isSelected = selectedConversationId === conversation._id;
        const isGroup = conversation.isGroup;
        const name = isGroup
          ? conversation.name || "Group"
          : `${otherUser?.firstName || ""} ${otherUser?.lastName || ""}`.trim() ||
            otherUser?.email ||
            "Unknown";
        const avatarFallback = isGroup
          ? name?.[0]?.toUpperCase()
          : otherUser?.firstName?.[0]?.toUpperCase() ||
            otherUser?.email?.[0]?.toUpperCase() ||
            "?";
        const isOnline =
          !isGroup && otherUser?._id && onlineUsers.has(otherUser._id);
        const lastMessageText = conversation.lastMessage?.text;
        const lastMessageTime =
          conversation.lastMessage?.createdAt || conversation.updatedAt;

        return (
          <button
            key={conversation._id}
            onClick={() => {
              onSelectConversation(conversation._id);
              if (pathname !== "/") {
                router.push("/");
              }
            }}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 cursor-pointer",
              "hover:bg-accent/10",
              isSelected
                ? "bg-primary/8 hover:bg-primary/12"
                : "hover:translate-x-0.5",
            )}
          >
            <div
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300",
                isSelected
                  ? "h-7 bg-primary opacity-100"
                  : "h-0 bg-primary opacity-0",
              )}
            />

            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10 ring-1 ring-border/50 transition-transform duration-200 group-hover:scale-[1.03]">
                <AvatarImage
                  src={isGroup ? "" : otherUser?.image || ""}
                  className="object-cover"
                />
                <AvatarFallback
                  className={cn(
                    "bg-linear-to-br text-white font-semibold text-sm flex items-center justify-center",
                    getGradient(name),
                  )}
                >
                  {isGroup ? <Users className="h-4 w-4" /> : avatarFallback}
                </AvatarFallback>
              </Avatar>
              {isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-sidebar animate-pulse-online" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-sm truncate leading-tight",
                    isSelected
                      ? "font-semibold text-foreground"
                      : "font-medium text-foreground/90",
                  )}
                >
                  {name}
                </span>
                {lastMessageTime && (
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                    {formatTime(lastMessageTime)}
                  </span>
                )}
              </div>
              {lastMessageText && (
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5 leading-relaxed">
                  {lastMessageText}
                </p>
              )}
            </div>

            {Number(conversation.unreadCount) > 0 && (
              <div className="shrink-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm animate-in zoom-in-50 duration-300">
                {(conversation.unreadCount ?? 0) > 99
                  ? "99+"
                  : conversation.unreadCount}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
