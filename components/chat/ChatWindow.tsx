"use client";

import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/components/SocketProvider";
import { useAppSelector, useAppDispatch } from "@/redux/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  FileText,
  Download,
  PhoneCall,
  Video,
  Wallet,
  Phone,
  MoreVertical,
  Pin,
  PinOff,
  Copy,
  Trash2,
  Smile,
  PanelLeft,
  Users,
  Menu,
} from "lucide-react";
import MessageInput from "./MessageInput";
import ReactionPicker from "./ReactionPicker";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { initiateCall, acceptCall } from "@/redux/features/chat/callSlice";
import { fetchBalance } from "@/redux/features/wallet/walletSlice";
import {
  fetchMessages,
  fetchConversationDetails,
  sendMessage,
  addMessage,
  markConversationAsRead,
  setPinnedMessage,
  deleteMessage,
  deleteMessageApi,
  toggleReaction,
  updateMessageReaction,
} from "@/redux/features/chat/chatSlice";
import type { Attachment } from "@/redux/features/chat/chatSlice";
import Link from "next/link";
import axios from "axios";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatWindowProps {
  conversationId: string;
}

import { useSidebar } from "@/components/ui/sidebar";
import { RootState } from "@/redux/store";

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

function formatDateSeparator(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d");
}

export default function ChatWindow({ conversationId }: ChatWindowProps) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) => state.chat.messages);
  const conversation = useAppSelector(
    (state) => state.chat.currentConversation,
  );
  const loading = useAppSelector((state) => state.chat.messagesLoading);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isAiLoading, setIsAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const { socket, isConnected, onlineUsers } = useSocket();
  const currentUser = useAppSelector((state) => state.auth.user);
  const balance = useAppSelector((state) => state.wallet.balance);
  const { state, isMobile, toggleSidebar } = useSidebar();
  const callStatus = useAppSelector((state: any) => state.call.status);
  const pinnedMessageId = useAppSelector((state) => state.chat.pinnedMessageId);
  const [activeCallInfo, setActiveCallInfo] = useState<{
    conversationId: string;
    isVideo: boolean;
    isGroup: boolean;
    participantCount: number;
  } | null>(null);

  const isTriggerVisible = isMobile || state === "collapsed";

  useEffect(() => {
    dispatch(fetchBalance());
  }, [dispatch]);

  useEffect(() => {
    notificationSoundRef.current = new Audio("/notification.wav");
    notificationSoundRef.current.volume = 0.5;
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket error:", err.message);
    });
  }, [socket]);

  useEffect(() => {
    if (conversationId) {
      dispatch(fetchMessages(conversationId));
      dispatch(fetchConversationDetails(conversationId));

      if (socket && isConnected) {
        socket.emit("join_conversation", { conversationId });
        socket.emit("mark_conversation_read", { conversationId });
      }

      dispatch(markConversationAsRead(conversationId));
    }

    return () => {
      if (socket && isConnected) {
        socket.emit("leave_conversation", { conversationId });
      }
    };
  }, [conversationId, socket, isConnected, dispatch]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleActiveCall = (data: any) => {
      if (data.conversationId === conversationId) {
        if (data.ended || data.participantCount === 0) {
          setActiveCallInfo(null);
        } else {
          setActiveCallInfo(data);
        }
      }
    };

    socket.on("call:active", handleActiveCall);

    return () => {
      socket.off("call:active", handleActiveCall);
    };
  }, [socket, isConnected, conversationId]);

  useEffect(() => {
    if (callStatus === "ongoing" || callStatus === "calling") {
      setActiveCallInfo(null);
    }
  }, [callStatus]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handlePinnedMessageUpdate = ({
      messageId,
      isPinned,
    }: {
      messageId: string | null;
      isPinned: boolean;
    }) => {
      dispatch(setPinnedMessage(isPinned ? messageId : null));
    };

    const handleNewMessage = (message: any) => {
      dispatch(addMessage(message));
      setTimeout(scrollToBottom, 100);

      const senderId =
        typeof message.sender === "string"
          ? message.sender
          : message.sender?._id;
      if (senderId !== currentUser?._id && notificationSoundRef.current) {
        notificationSoundRef.current.currentTime = 0;
        notificationSoundRef.current.play().catch(() => { });

        if (conversationId) {
          dispatch(markConversationAsRead(conversationId));
        }
      }
    };

    const handleUserTyping = ({
      userId,
      isTyping,
    }: {
      userId: string;
      isTyping: boolean;
    }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (isTyping) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    };

    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      dispatch(deleteMessage(messageId));
    };

    const handleReactionUpdated = ({
      messageId,
      reactions,
    }: {
      messageId: string;
      reactions: any[];
    }) => {
      dispatch(updateMessageReaction({ messageId, reactions }));
    };

    socket.on("new_message", handleNewMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("pinned_message_updated", handlePinnedMessageUpdate);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("reaction_updated", handleReactionUpdated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("pinned_message_updated", handlePinnedMessageUpdate);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("reaction_updated", handleReactionUpdated);
    };
  }, [socket, isConnected, conversationId, dispatch]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSendMessage = async (
    text: string,
    attachments?: Attachment[],
  ) => {
    try {
      const resultAction = await dispatch(
        sendMessage({ conversationId, text, attachments }),
      );
      if (sendMessage.fulfilled.match(resultAction)) {
        const newMessage = resultAction.payload;
        setTimeout(scrollToBottom, 50);

        if (socket && isConnected) {
          socket.emit("send_message", {
            conversationId,
            message: newMessage,
          });

          if (conversation?.isSupportTicket && currentUser?.role !== "ADMIN") {
            try {
              const notifyRes = await axios.post("/api/admin/notifications", {
                type: "ticket_message",
                title: "New Ticket Message",
                message: `${currentUser?.firstName || "A user"} replied to ${conversation.name}`,
                link: `/dashboard/admin-tickets/${conversationId}`,
                relatedId: conversationId,
              });
              socket.emit("admin:notify", notifyRes.data.data);
            } catch (e) {
              console.error("Failed to notify admins of ticket message", e);
            }
          }

          if (text.trim().toLowerCase().startsWith("@ai")) {
            const prompt = text.replace(/^@ai/i, "").trim() || "Thinking...";
            setIsAiLoading(true);

            try {
              const aiRes = await axios.post("/api/ai", {
                prompt,
                conversationId,
              });

              if (aiRes.data?.data) {
                const aiMsg = aiRes.data.data;
                dispatch(addMessage(aiMsg));

                if (socket && isConnected) {
                  socket.emit("send_message", {
                    conversationId,
                    message: aiMsg,
                  });
                }
                setTimeout(scrollToBottom, 50);
              }
            } catch (err) {
              console.error("AI Error:", err);
              toast.error("AI Assistant is having trouble thinking right now.");
            } finally {
              setIsAiLoading(false);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (socket && isConnected) {
      socket.emit("typing", { conversationId, isTyping });
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const resultAction = await dispatch(
        toggleReaction({ conversationId, messageId, emoji }),
      ).unwrap();

      if (socket && isConnected) {
        socket.emit("message_reaction", {
          conversationId,
          messageId,
          reactions: resultAction.reactions,
        });
      }
    } catch (error: any) {
      toast.error(error || "Failed to update reaction");
    }
  };

  const pinnedMessage = messages.find((m) => m._id === pinnedMessageId);

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary/50" />
        <p className="text-xs text-muted-foreground/50">Loading messages...</p>
      </div>
    );
  }

  const getConversationDetails = () => {
    if (!conversation) return { name: "Loading...", image: null };
    if (conversation.isGroup) {
      return {
        name: conversation.name,
        image: null,
        isGroup: true,
      };
    }
    const otherUser = conversation.participants.find(
      (p) => p._id !== currentUser?._id,
    );
    return {
      name: otherUser?.firstName || otherUser?.email || "Unknown User",
      image: otherUser?.image,
      firstName: otherUser?.firstName,
      email: otherUser?.email,
      isGroup: false,
    };
  };

  const details = getConversationDetails();
  const otherUser = conversation?.participants.find(
    (p) => p._id !== currentUser?._id,
  );
  const isOnline =
    !details.isGroup && otherUser?._id && onlineUsers.has(otherUser._id);

  const headerName = details.name || "Chat";
  const headerGradient = getGradient(headerName);

  return (
    <div className="relative flex flex-col h-full w-full bg-transparent overflow-hidden">
      <div className="absolute top-2.5 left-4 right-4 z-20 border border-border/40 bg-background/60 backdrop-blur-md p-2.5 flex items-center gap-2.5 shadow-sm rounded-2xl transition-all duration-300 hover:bg-background/80 hover:shadow-md">
        {isTriggerVisible && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 cursor-pointer"
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        )}

        <div className="relative shrink-0">
          <Avatar className="h-9 w-9 ring-1 ring-border/40">
            <AvatarImage src={details.image || ""} className="object-cover" />
            <AvatarFallback
              className={cn(
                "bg-linear-to-br text-white font-semibold text-sm",
                headerGradient,
              )}
            >
              {details.isGroup ? (
                <Users className="h-4 w-4" />
              ) : (
                details.firstName?.[0] ||
                details.email?.[0]?.toUpperCase() ||
                "?"
              )}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <h2 className="font-semibold text-sm leading-tight tracking-tight truncate">
            {details.name}
          </h2>
          {details.isGroup ? (
            <span className="text-[11px] text-muted-foreground/70">
              {conversation?.participants.length} members
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full inline-block",
                  isOnline
                    ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]"
                    : "bg-muted-foreground/30",
                )}
              />
              {isOnline ? "Online" : "Offline"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {!conversation?.isSupportTicket && (
            <Link href="/wallet">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-8 px-2.5 transition-colors text-primary hover:bg-primary/10 gap-1.5 cursor-pointer"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold hidden sm:inline">
                  {(balance ?? 0).toLocaleString()}
                </span>
              </Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-8 w-8 transition-colors cursor-pointer",
              details.isGroup || isOnline
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground/30 cursor-not-allowed",
            )}
            disabled={!details.isGroup && !isOnline}
            onClick={() => {
              if (conversation && socket) {
                const participants = conversation.participants
                  .filter((p) => p._id !== currentUser?._id)
                  .map((p) => ({
                    id: p._id,
                    name: p.firstName || p.email || "User",
                    image: p.image,
                  }));

                dispatch(
                  initiateCall({
                    conversationId,
                    participants,
                    isGroup: !!conversation.isGroup,
                    isVideo: true,
                  }),
                );

                socket.emit("call:initiate", {
                  conversationId,
                  participants,
                  isGroup: !!conversation.isGroup,
                  isVideo: true,
                  callerInfo: {
                    name:
                      currentUser?.firstName || currentUser?.email || "User",
                    image: currentUser?.image,
                  },
                });
              }
            }}
          >
            <Video className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-8 w-8 transition-colors cursor-pointer",
              details.isGroup || isOnline
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground/30 cursor-not-allowed",
            )}
            disabled={!details.isGroup && !isOnline}
            onClick={() => {
              if (conversation && socket) {
                const participants = conversation.participants
                  .filter((p) => p._id !== currentUser?._id)
                  .map((p) => ({
                    id: p._id,
                    name: p.firstName || p.email || "User",
                    image: p.image,
                  }));

                dispatch(
                  initiateCall({
                    conversationId,
                    participants,
                    isGroup: !!conversation.isGroup,
                    isVideo: false,
                  }),
                );

                socket.emit("call:initiate", {
                  conversationId,
                  participants,
                  isGroup: !!conversation.isGroup,
                  isVideo: false,
                  callerInfo: {
                    name:
                      currentUser?.firstName || currentUser?.email || "User",
                    image: currentUser?.image,
                  },
                });
              }
            }}
          >
            <PhoneCall className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeCallInfo && callStatus === "idle" && (
        <div className="absolute left-0 right-0 bottom-17 z-50 px-4 py-2 bg-green-500/10 border border-green-500/20 flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              A {activeCallInfo?.isVideo ? "video" : "voice"} call is in
              progress
              {activeCallInfo?.participantCount > 0
                ? ` · ${activeCallInfo?.participantCount} participant${activeCallInfo?.participantCount > 1 ? "s" : ""}`
                : ""}
            </span>
          </div>
          <Button
            size="sm"
            className="rounded-full bg-green-500 hover:bg-green-600 text-white gap-1.5 h-8 px-4 cursor-pointer"
            onClick={() => {
              if (conversation && socket) {
                const participants = conversation.participants
                  .filter((p) => p._id !== currentUser?._id)
                  .map((p) => ({
                    id: p._id,
                    name: p.firstName || p.email || "User",
                    image: p.image,
                  }));

                dispatch(
                  initiateCall({
                    conversationId,
                    participants,
                    isGroup: !!conversation.isGroup,
                    isVideo: activeCallInfo?.isVideo,
                  }),
                );
                dispatch(acceptCall());

                socket.emit("call:join", {
                  conversationId,
                  userInfo: {
                    name:
                      currentUser?.firstName || currentUser?.email || "User",
                    image: currentUser?.image,
                  },
                });

                setActiveCallInfo(null);
              }
            }}
          >
            <Phone className="h-3.5 w-3.5" />
            Join Call
          </Button>
        </div>
      )}

      {pinnedMessage && (
        <div className="mx-4 mt-18 mb-[-60px] z-10 p-2.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="h-7 w-1 bg-primary rounded-full shrink-0" />
            <Pin className="h-3 w-3 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground truncate italic">
              &ldquo;{pinnedMessage.text}&rdquo;
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-6 px-2 shrink-0 cursor-pointer"
            onClick={() => {
              if (socket) {
                socket.emit("pin_message", {
                  conversationId,
                  messageId: pinnedMessageId,
                  isPinned: false,
                });
              }
            }}
          >
            Unpin
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1 h-full w-full">
        <div className="flex flex-col gap-3 pt-20 pb-24 px-4 sm:px-6">
          {messages.map((msg: any, index: number) => {
            const senderId =
              typeof msg.sender === "string" ? msg.sender : msg.sender._id;
            const isMe = senderId === currentUser?._id;

            const prevMsg = index > 0 ? messages[index - 1] : null;
            const prevSenderId = prevMsg
              ? typeof prevMsg.sender === "string"
                ? prevMsg.sender
                : prevMsg.sender._id
              : null;

            const isPrevFromSame = index > 0 && prevSenderId === senderId;

            const msgDate = new Date(msg.createdAt);
            const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;
            const showDateSeparator =
              !prevDate || !isSameDay(msgDate, prevDate);

            const senderName =
              typeof msg.sender === "object"
                ? msg.sender.firstName || msg.sender.email || "Unknown"
                : "";
            const senderForGradient =
              typeof msg.sender === "object"
                ? `${msg.sender.firstName || ""} ${msg.sender.lastName || ""}`.trim() ||
                msg.sender.email ||
                "U"
                : "U";

            const isAi =
              typeof msg.sender === "object" &&
              msg.sender.email === "ai.assistant@system.local";

            return (
              <div key={msg._id}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-4">
                    <div className="px-3 py-1 rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground/70 tracking-wide">
                      {formatDateSeparator(msg.createdAt)}
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "flex gap-2.5 max-w-[85%] md:max-w-[70%] group",
                    isMe ? "ml-auto flex-row-reverse" : "",
                    !isPrevFromSame ? "mt-3" : "mt-0.5",
                  )}
                >
                  {!isMe && !isPrevFromSame ? (
                    <Avatar className="h-7 w-7 mt-1 ring-1 ring-border/30 shrink-0">
                      <AvatarImage
                        src={
                          typeof msg.sender === "object" ? msg.sender.image : ""
                        }
                        className="object-cover"
                      />
                      <AvatarFallback
                        className={cn(
                          "bg-linear-to-br text-white font-semibold text-[10px]",
                          isAi
                            ? "from-violet-500 to-purple-600"
                            : getGradient(senderForGradient),
                        )}
                      >
                        {isAi
                          ? "AI"
                          : typeof msg.sender === "object" &&
                            msg.sender.firstName
                            ? msg.sender.firstName[0]
                            : "?"}
                      </AvatarFallback>
                    </Avatar>
                  ) : !isMe ? (
                    <div className="w-7 shrink-0" />
                  ) : null}

                  <div
                    className={cn(
                      "flex flex-col",
                      isMe ? "items-end" : "items-start",
                    )}
                  >
                    {!isMe &&
                      !isPrevFromSame &&
                      (conversation?.isGroup || isAi) && (
                        <span className="text-[10px] font-semibold text-muted-foreground/60 mb-0.5 px-1">
                          {isAi ? "AI Assistant" : senderName}
                        </span>
                      )}

                    <div
                      className={cn(
                        "px-4 py-2 text-sm transition-all duration-200 flex items-center gap-2 group/msg",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm hover:brightness-110"
                          : cn(
                            "bg-card border border-border/40 text-card-foreground rounded-2xl rounded-tl-sm hover:bg-accent/30",
                            isAi && "shadow-sm",
                          ),
                      )}
                    >
                      <div className="flex-1">
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-col gap-2 mb-2">
                            {msg.attachments.map(
                              (attachment: Attachment, i: number) => (
                                <div
                                  key={i}
                                  className="rounded-lg overflow-hidden border border-border/20 bg-background/5"
                                >
                                  {attachment.type.startsWith("image/") ? (
                                    <img
                                      src={attachment.url}
                                      alt={attachment.name}
                                      className="max-w-full max-h-60 object-contain cursor-pointer transition-transform hover:scale-[1.02]"
                                      onClick={() =>
                                        window.open(attachment.url, "_blank")
                                      }
                                    />
                                  ) : attachment.type.startsWith("video/") ? (
                                    <video
                                      src={attachment.url}
                                      controls
                                      className="max-w-full max-h-60 rounded-md"
                                    />
                                  ) : attachment.type.startsWith("audio/") ? (
                                    <div className="p-2 bg-background/50 rounded-lg flex items-center gap-2 max-w-full overflow-hidden">
                                      <audio
                                        src={attachment.url}
                                        controls
                                        className="max-w-full focus:outline-none"
                                      />
                                    </div>
                                  ) : (
                                    <a
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-3 p-3 bg-background transition-colors text-secondary group/file"
                                    >
                                      <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                                        <FileText className="h-4 w-4" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-medium truncate">
                                          {attachment.name}
                                        </span>
                                        <span className="text-[10px] opacity-70">
                                          {(attachment.size / 1024).toFixed(1)}{" "}
                                          KB
                                        </span>
                                      </div>
                                      <Download className="h-3.5 w-3.5 ml-auto opacity-0 group-hover/file:opacity-100 transition-opacity" />
                                    </a>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                        {msg.text && (
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6 shrink-0 transition-opacity cursor-pointer",
                                msg.isPinned
                                  ? "opacity-100 text-primary hover:bg-primary/10"
                                  : cn(
                                    "opacity-0 group-hover/msg:opacity-100 text-muted-foreground hover:bg-accent",
                                    isMobile && "opacity-100",
                                  ),
                              )}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isMe ? "end" : "start"}>
                            <ReactionPicker
                              onSelect={(emoji) =>
                                handleToggleReaction(msg._id, emoji)
                              }
                              isSubMenu={true}
                            />
                            <DropdownMenuItem
                              onClick={() => {
                                if (msg.text) {
                                  navigator.clipboard.writeText(msg.text);
                                  toast.success("Message copied to clipboard");
                                }
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Text
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (socket) {
                                  socket.emit("pin_message", {
                                    conversationId,
                                    messageId: msg._id,
                                    isPinned: !msg.isPinned,
                                  });
                                }
                              }}
                            >
                              {msg.isPinned ? (
                                <>
                                  <PinOff className="h-4 w-4 mr-2" />
                                  Unpin Message
                                </>
                              ) : (
                                <>
                                  <Pin className="h-4 w-4 mr-2" />
                                  Pin Message
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                if (msg.text) {
                                  toast.info("AI is analyzing...");
                                  setIsAiLoading(true);
                                  try {
                                    const aiRes = await axios.post("/api/ai", {
                                      prompt:
                                        "Please explain the meaning or intent of this message.",
                                      context: msg.text,
                                      conversationId,
                                    });

                                    if (aiRes.data?.data) {
                                      const aiMsg = aiRes.data.data;
                                      dispatch(addMessage(aiMsg));
                                      if (socket && isConnected) {
                                        socket.emit("send_message", {
                                          conversationId,
                                          message: aiMsg,
                                        });
                                      }
                                      setTimeout(scrollToBottom, 50);
                                    }
                                  } catch (err) {
                                    toast.error(
                                      "Failed to generate AI response.",
                                    );
                                  } finally {
                                    setIsAiLoading(false);
                                  }
                                }
                              }}
                            >
                              <Smile className="h-4 w-4 mr-2" />
                              Explain with AI
                            </DropdownMenuItem>
                            {isMe && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={async () => {
                                  if (
                                    confirm(
                                      "Are you sure you want to delete this message?",
                                    )
                                  ) {
                                    try {
                                      await dispatch(
                                        deleteMessageApi({
                                          conversationId,
                                          messageId: msg._id,
                                        }),
                                      ).unwrap();

                                      if (socket) {
                                        socket.emit("delete_message", {
                                          conversationId,
                                          messageId: msg._id,
                                        });
                                      }
                                    } catch (err: any) {
                                      toast.error(
                                        err || "Failed to delete message",
                                      );
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Message
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {msg.reactions && msg.reactions.length > 0 && (
                      <div
                        className={cn(
                          "flex flex-wrap gap-1 mt-1 px-1",
                          isMe ? "justify-end" : "justify-start",
                        )}
                      >
                        {msg.reactions?.map((reaction: any, i: number) => (
                          <button
                            key={i}
                            onClick={() =>
                              handleToggleReaction(msg._id, reaction.emoji)
                            }
                            className={cn(
                              "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors cursor-pointer",
                              reaction.users.includes(currentUser?._id || "")
                                ? "bg-primary/10 border-primary/30 text-primary"
                                : "bg-background/50 border-border/50 hover:bg-accent",
                            )}
                          >
                            <span>{reaction.emoji}</span>
                            {reaction.users.length > 1 && (
                              <span className="font-medium">
                                {reaction.users.length}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    <span
                      className={cn(
                        "text-[10px] text-muted-foreground/40 mt-0.5 px-1 transition-opacity duration-200",
                        isMe ? "text-right" : "text-left",
                      )}
                    >
                      {format(new Date(msg.createdAt), "p")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {isAiLoading && (
            <div className="flex gap-2.5 max-w-[85%] md:max-w-[70%] mt-3 animate-in fade-in slide-in-from-bottom-2">
              <Avatar className="h-7 w-7 mt-1 ring-1 ring-border/30 shrink-0">
                <AvatarFallback className="bg-linear-to-br from-violet-500 to-purple-600 text-white font-semibold text-[10px]">
                  AI
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-semibold text-muted-foreground/60 mb-0.5 px-1">
                  AI Assistant
                </span>
                <div className="px-4 py-3 bg-card border border-border/40 text-card-foreground rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 bg-primary rounded-full animate-dot-typing" />
                  <div className="h-1.5 w-1.5 bg-primary rounded-full animate-dot-typing [animation-delay:0.2s]" />
                  <div className="h-1.5 w-1.5 bg-primary rounded-full animate-dot-typing [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {typingUsers.size > 0 && (
        <div className="absolute bottom-20 left-8 z-10 px-3.5 py-2 rounded-2xl bg-background/80 backdrop-blur-sm border border-border/30 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-1">
            <span
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </div>
      )}

      <div className="absolute bottom-1.5 left-4 right-4 z-20">
        <MessageInput
          conversationId={conversationId}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          recipientId={otherUser?._id}
          recipientName={details.name || "User"}
          isSupportChat={conversation?.isSupportTicket}
        />
      </div>
    </div>
  );
}
