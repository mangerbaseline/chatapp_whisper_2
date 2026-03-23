"use client";

import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchConnections,
  removeConnection,
  Connection,
} from "@/redux/features/connections/connectionsSlice";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  UserMinus,
  Users,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/components/SocketProvider";
import { createConversation } from "@/redux/features/chat/chatSlice";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

const PAGE_SIZE = 10;

export default function ConnectionsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { connections, loading, error } = useSelector(
    (state: RootState) => state.connections,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Connection | null>(null);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);
  const router = useRouter();
  const { socket } = useSocket();

  useEffect(() => {
    dispatch(fetchConnections());
  }, [dispatch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connections;
    const q = searchQuery.toLowerCase();
    return connections.filter((connection: Connection) => {
      const fullName =
        `${connection.firstName || ""} ${connection.lastName || ""}`.toLowerCase();
      const email = connection.email.toLowerCase();
      return fullName.includes(q) || email.includes(q);
    });
  }, [connections, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredConnections.length / PAGE_SIZE),
  );
  const paginatedConnections = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredConnections.slice(start, start + PAGE_SIZE);
  }, [filteredConnections, currentPage]);

  const handleRemoveConnection = async (connectionId: string) => {
    setRemovingId(connectionId);
    await dispatch(removeConnection(connectionId));
    setRemovingId(null);
    setConfirmRemove(null);
  };

  const handleStartChat = async (userId: string) => {
    setStartingChatId(userId);
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

        router.push("/");
      }
    } catch (error) {
      console.error("Failed to start conversation", error);
    } finally {
      setStartingChatId(null);
    }
  };

  const getInitials = (connection: Connection) => {
    const first = connection.firstName?.[0] || "";
    const last = connection.lastName?.[0] || "";
    return (first + last).toUpperCase() || connection.email[0].toUpperCase();
  };

  return (
    <section className="flex flex-col gap-5 h-full">
      <PageHeader
        title="Connections"
        description={`${filteredConnections.length} connection${filteredConnections.length !== 1 ? "s" : ""}`}
        icon={<Users className="h-4 w-4 text-primary" />}
      />

      <div className="px-4 py-4 md:px-6 flex flex-col gap-5 flex-1 max-w-5xl mx-auto w-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-muted/40 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-colors"
          />
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
          </div>
        )}

        {!loading && connections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
              <Users className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No connections yet</h3>
            <p className="text-xs text-muted-foreground/60 max-w-xs">
              Search for users and send invitations to build your network.
            </p>
          </div>
        )}

        {!loading &&
          connections.length > 0 &&
          filteredConnections.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground/60">
                No connections match &quot;{searchQuery}&quot;
              </p>
            </div>
          )}

        {!loading && paginatedConnections.length > 0 && (
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
            {paginatedConnections.map((connection: Connection) => (
              <div
                key={connection._id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border/30 bg-card hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0 ring-2 ring-border/10">
                    <AvatarImage
                      src={connection.image}
                      alt={connection.firstName || connection.email}
                    />
                    <AvatarFallback className="text-xs bg-linear-to-br from-primary to-primary/60 text-primary-foreground font-bold">
                      {getInitials(connection)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">
                      {connection.firstName || ""} {connection.lastName || ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                      {connection.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden sm:flex text-xs text-primary hover:text-primary/90 hover:bg-primary/10 rounded-lg cursor-pointer gap-1.5 h-8 px-3"
                    disabled={startingChatId === connection._id}
                    onClick={() => handleStartChat(connection._id)}
                  >
                    {startingChatId === connection._id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <MessageCircle className="h-3.5 w-3.5" />
                        Message
                      </>
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground/60 hover:text-foreground cursor-pointer"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-44 rounded-xl"
                    >
                      <DropdownMenuItem
                        className="gap-2 text-xs cursor-pointer sm:hidden"
                        onClick={() => handleStartChat(connection._id)}
                        disabled={startingChatId === connection._id}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Send Message
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="sm:hidden" />
                      <DropdownMenuItem
                        className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                        onClick={() => setConfirmRemove(connection)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Remove Connection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredConnections.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 pt-2 pb-1 border-t border-border/10">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg cursor-pointer"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground/70 tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg cursor-pointer"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <AlertDialog
          open={!!confirmRemove}
          onOpenChange={(open) => !open && setConfirmRemove(null)}
        >
          <AlertDialogContent className="rounded-2xl border-border/40">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold">
                Remove Connection
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground/70">
                Are you sure you want to remove{" "}
                <span className="font-medium text-foreground">
                  {confirmRemove?.firstName} {confirmRemove?.lastName}
                </span>{" "}
                from your connections? You will need to send a new invitation to
                reconnect.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer rounded-xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  confirmRemove && handleRemoveConnection(confirmRemove._id)
                }
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer rounded-xl"
                disabled={removingId === confirmRemove?._id}
              >
                {removingId === confirmRemove?._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Remove"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
