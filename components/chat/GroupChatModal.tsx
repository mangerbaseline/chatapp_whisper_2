"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Loader2,
  X,
  Users as UsersIcon,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { useSocket } from "@/components/SocketProvider";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  searchUsers,
  clearSearchResults,
} from "@/redux/features/connections/connectionsSlice";
import { createConversation } from "@/redux/features/chat/chatSlice";
import type { User } from "@/redux/features/connections/connectionsSlice";
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

interface GroupChatModalProps {
  onSelectConversation: (conversationId: string) => void;
  children?: React.ReactNode;
  tooltip?: string;
}

export default function GroupChatModal({
  onSelectConversation,
  children,
  tooltip,
}: GroupChatModalProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
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
      setSelectedUsers([]);
      setGroupName("");
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

  const toggleUser = (user: User) => {
    if (selectedUsers.some((u) => u._id === user._id)) {
      setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
      setQuery("");
      dispatch(clearSearchResults());
    }
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u._id !== userId));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    if (selectedUsers.length < 2) return;

    setCreating(true);
    try {
      const resultAction = await dispatch(
        createConversation({
          isGroup: true,
          name: groupName,
          members: selectedUsers.map((u) => u._id),
        }),
      );

      if (createConversation.fulfilled.match(resultAction)) {
        const conversation = resultAction.payload;

        if (socket) {
          socket.emit("conversation_created", {
            conversation: conversation,
            participantIds: selectedUsers.map((u) => u._id),
          });
        }

        onSelectConversation(conversation._id);
        setOpen(false);
      }
    } catch (error) {
      console.error("Failed to create group", error);
    } finally {
      setCreating(false);
    }
  };

  const trigger = (
    <DialogTrigger asChild>
      {children ? (
        children
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="cursor-pointer w-full justify-start mb-1 border-none"
        >
          <UsersIcon className="h-4 w-4" />
          <span>New Group Chat</span>
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
            Create Group Chat
          </DialogTitle>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Add at least 2 members to create a group
          </p>
        </DialogHeader>

        <div className="px-5 space-y-4 pb-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="group-name"
              className="text-xs font-medium text-muted-foreground/80"
            >
              Group Name
            </Label>
            <Input
              id="group-name"
              placeholder="e.g. Project Team"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="h-10 rounded-xl bg-muted/40 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-colors"
            />
          </div>

          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((user) => {
                const name =
                  `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                  user.email;
                return (
                  <div
                    key={user._id}
                    className="group flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-full bg-primary/8 border border-primary/15 transition-colors hover:bg-primary/12"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={user.image} className="object-cover" />
                      <AvatarFallback
                        className={cn(
                          "bg-linear-to-br text-white text-[9px] font-semibold",
                          getGradient(name),
                        )}
                      >
                        {user.firstName ? user.firstName[0] : user.email[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground/80">
                      {user.firstName || user.email.split("@")[0]}
                    </span>
                    <button
                      onClick={() => handleRemoveUser(user._id)}
                      className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-destructive/15 hover:text-destructive transition-colors cursor-pointer"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground/80">
              Add Members
            </Label>
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
        </div>

        <div className="border-t border-border/10">
          <ScrollArea className="h-[200px]">
            <div className="p-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
                  <p className="text-xs text-muted-foreground/50">
                    Searching...
                  </p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-0.5">
                  {searchResults
                    .filter(
                      (user) =>
                        !selectedUsers.some(
                          (selected) => selected._id === user._id,
                        ),
                    )
                    .map((user) => {
                      const name =
                        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                        user.email;
                      return (
                        <button
                          key={user._id}
                          onClick={() => toggleUser(user)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-all duration-200 text-left group cursor-pointer"
                        >
                          <Avatar className="h-9 w-9 ring-1 ring-border/30 transition-transform duration-200 group-hover:scale-[1.03]">
                            <AvatarImage
                              src={user.image}
                              className="object-cover"
                            />
                            <AvatarFallback
                              className={cn(
                                "bg-linear-to-br text-white font-semibold text-xs",
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
                          <div className="h-7 w-7 rounded-lg bg-primary/8 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                        </button>
                      );
                    })}
                  {searchResults.filter(
                    (user) =>
                      !selectedUsers.some(
                        (selected) => selected._id === user._id,
                      ),
                  ).length === 0 && (
                    <p className="text-center text-xs text-muted-foreground/50 py-4">
                      All matching users already added
                    </p>
                  )}
                </div>
              ) : query.length >= 2 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <p className="text-sm text-muted-foreground/60">
                    No users found
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs text-muted-foreground/50 text-center">
                    {selectedUsers.length > 0
                      ? "Search to add more members"
                      : "Search to add members"}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-5 py-4 border-t border-border/10 bg-muted/20">
          <Button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedUsers.length < 2 || creating}
            className="w-full h-10 rounded-xl font-medium shadow-sm cursor-pointer gap-2"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UsersIcon className="h-4 w-4" />
            )}
            {creating
              ? "Creating..."
              : `Create Group${selectedUsers.length > 0 ? ` (${selectedUsers.length} members)` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
