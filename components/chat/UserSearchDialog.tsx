"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Loader2,
  UserPlus,
  MessageCircle,
  Clock,
  Check,
  SearchX,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSocket } from "@/components/SocketProvider";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  searchUsers,
  sendInvitation,
  acceptInvitation,
  clearSearchResults,
} from "@/redux/features/connections/connectionsSlice";
import { createConversation } from "@/redux/features/chat/chatSlice";
import type { User } from "@/redux/features/connections/connectionsSlice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const gradients = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-orange-400 to-rose-500",
  "from-pink-500 to-fuchsia-500",
  "from-indigo-500 to-blue-600",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

interface UserSearchDialogProps {
  onSelectUser: (conversationId: string) => void;
  children?: React.ReactNode;
  tooltip?: string;
}

export default function UserSearchDialog({
  onSelectUser,
  children,
  tooltip,
}: UserSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const searchResults = useAppSelector(
    (state) => state.connections.searchResults,
  );
  const loading = useAppSelector((state) => state.connections.loading);

  useEffect(() => {
    if (open) {
      dispatch(clearSearchResults());
    } else {
      setQuery("");
      dispatch(clearSearchResults());
    }
  }, [open, dispatch]);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim().length > 0) {
      dispatch(searchUsers(value));
    } else {
      dispatch(clearSearchResults());
    }
  };

  const handleStartChat = async (userId: string) => {
    setActionLoading(userId);
    try {
      const resultAction = await dispatch(
        createConversation({
          otherUserId: userId,
        }),
      );

      if (createConversation.fulfilled.match(resultAction)) {
        const conversation = resultAction.payload;

        if (socket) {
          socket.emit("conversation_created", {
            conversation: conversation,
            otherUserId: userId,
          });
        }

        onSelectUser(conversation._id);
        setOpen(false);
      }
    } catch (error) {
      console.error("Failed to start conversation", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendInvite = async (userId: string) => {
    setActionLoading(userId);
    try {
      const resultAction = await dispatch(sendInvitation(userId));

      if (sendInvitation.fulfilled.match(resultAction)) {
        const invitation = resultAction.payload;
        if (socket) {
          socket.emit("send_invite", {
            receiverId: userId,
            invitation: invitation,
          });
        }
      }
    } catch (error: any) {
      console.error("Failed to send invitation", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptInvite = async (userId: string, invitationId?: string) => {
    if (!invitationId) return;

    setActionLoading(userId);
    try {
      const resultAction = await dispatch(acceptInvitation(invitationId));

      if (acceptInvitation.fulfilled.match(resultAction)) {
        if (socket) {
          socket.emit("accept_invite", {
            senderId: userId,
            invitation: { _id: invitationId, sender: { _id: userId } },
          });
        }
        dispatch(searchUsers(query));
      }
    } catch (error) {
      console.error("Failed to accept invitation", error);
    } finally {
      setActionLoading(null);
    }
  };

  const renderActionButton = (user: User) => {
    const isLoading = actionLoading === user._id;

    switch (user.inviteStatus) {
      case "connected":
        return (
          <Button
            size="sm"
            onClick={() => handleStartChat(user._id)}
            disabled={isLoading}
            className="h-8 rounded-lg gap-1.5 text-xs font-medium shadow-sm cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <MessageCircle className="h-3.5 w-3.5" />
                Chat
              </>
            )}
          </Button>
        );

      case "pending_sent":
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled
            className="h-8 rounded-lg gap-1.5 text-xs font-medium opacity-60"
          >
            <Clock className="h-3.5 w-3.5" />
            Pending
          </Button>
        );

      case "pending_received":
        return (
          <Button
            size="sm"
            variant="default"
            onClick={() => handleAcceptInvite(user._id, user.invitationId)}
            disabled={isLoading}
            className="h-8 rounded-lg gap-1.5 text-xs font-medium shadow-sm cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Accept
              </>
            )}
          </Button>
        );

      default:
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSendInvite(user._id)}
            disabled={isLoading}
            className="h-8 rounded-lg gap-1.5 text-xs font-medium cursor-pointer hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" />
                Invite
              </>
            )}
          </Button>
        );
    }
  };

  const trigger = (
    <DialogTrigger asChild>
      {children ? (
        children
      ) : (
        <Button size="sm" variant="secondary" className="cursor-pointer">
          <Search className="h-4 w-4" />
        </Button>
      )}
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-border/40">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-lg font-semibold">
            Search Users
          </DialogTitle>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Find people to connect and chat with
          </p>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Search by name, email or mobile..."
              className="pl-9 h-10 rounded-xl bg-muted/40 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-colors"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-border/10">
          <ScrollArea className="h-[320px]">
            <div className="p-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                  <p className="text-xs text-muted-foreground/50">
                    Searching...
                  </p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {query.length === 0 && (
                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-2 mb-2">
                      Suggested Users
                    </p>
                  )}
                  {searchResults.map((user, index) => {
                    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
                    return (
                      <div
                        key={user._id}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-all duration-200 group"
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                      >
                        <Avatar className="h-10 w-10 ring-1 ring-border/30 transition-transform duration-200 group-hover:scale-[1.03]">
                          <AvatarImage
                            src={user.image}
                            className="object-cover"
                          />
                          <AvatarFallback
                            className={cn(
                              "bg-linear-to-br text-white font-semibold text-sm",
                              getGradient(name),
                            )}
                          >
                            {user.firstName
                              ? user.firstName[0]
                              : user.email[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 truncate">
                            {user.email}
                          </p>
                        </div>
                        {renderActionButton(user)}
                      </div>
                    );
                  })}
                </div>
              ) : query.length >= 2 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <SearchX className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground/70">
                      No users found
                    </p>
                    <p className="text-xs text-muted-foreground/40 mt-0.5">
                      Try a different search term
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Search className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground/50">
                    Type to search users...
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
