"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Settings,
  Search,
  Link2,
  X,
  CalendarDays,
  Wallet,
  LogOut,
  Users,
} from "lucide-react";
import Link from "next/link";
import ConversationList from "@/components/chat/ConversationList";
import UserSearchDialog from "@/components/chat/UserSearchDialog";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { selectConversation } from "@/redux/features/chat/chatSlice";
import GroupChatModal from "./GroupChatModal";
import Image from "next/image";
import { ModeToggle } from "@/components/ModeToggle";
import InviteNotifications from "../InviteNotifications";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { clearUser, logout } from "@/redux/features/auth/authSlice";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function ChatSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const selectedConversationId = useSelector(
    (state: RootState) => state.chat.selectedConversationId,
  );
  const { isMobile, setOpenMobile } = useSidebar();
  const router = useRouter();

  const handleSelectConversation = (id: string) => {
    dispatch(selectConversation(id));
    setOpenMobile(false);
  };

  const handleLogout = async () => {
    try {
      await dispatch(logout() as any).unwrap();
      dispatch(clearUser());
      toast.success("Logged out successfully.");
      setTimeout(() => {
        router.push("/auth/sign-in");
        router.refresh();
      }, 100);
    } catch (err: any) {
      toast.error(err?.message || "Logout failed.");
    }
  };

  return (
    <Sidebar className="h-screen border-r border-border/30" {...props}>
      <SidebarHeader className="h-14 px-4 flex flex-row items-center justify-between shrink-0 border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <SidebarTrigger className="-ml-1.5 text-muted-foreground hover:text-foreground transition-colors" />
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Image
              src="/textLogo.png"
              alt="Logo"
              width={100}
              height={32}
              className="h-5 w-auto object-contain"
            />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <InviteNotifications />
          {isMobile && (
            <button
              onClick={() => setOpenMobile(false)}
              className="rounded-lg p-1.5 hover:bg-muted transition-colors"
              aria-label="Close sidebar"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/10">
        <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
          Messages
        </span>
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-0.5">
            <UserSearchDialog
              onSelectUser={(conversationId: string) => {
                dispatch(selectConversation(conversationId));
                if (isMobile) setOpenMobile(false);
              }}
              tooltip="Search Users"
            >
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-all duration-200"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="sr-only">Search Users</span>
              </Button>
            </UserSearchDialog>

            <GroupChatModal
              onSelectConversation={(conversationId: string) => {
                dispatch(selectConversation(conversationId));
                if (isMobile) setOpenMobile(false);
              }}
              tooltip="New Group Chat"
            >
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-all duration-200"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="sr-only">New Group</span>
              </Button>
            </GroupChatModal>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/connections" onClick={() => isMobile && setOpenMobile(false)}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-all duration-200"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Connections</span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Connections
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <SidebarContent className="sidebar-scrollbar">
        <div className="py-1">
          <ConversationList
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
          />
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/20 p-3">
        <div className="flex items-center gap-3 mb-2 px-1">
          <Avatar className="h-8 w-8 ring-1 ring-border/40 shrink-0">
            <AvatarImage
              src={user?.image || "/man.png"}
              className="object-cover"
            />
            <AvatarFallback className="bg-linear-to-br from-primary/80 to-primary text-primary-foreground text-xs font-semibold">
              {user?.firstName?.[0]?.toUpperCase() ||
                user?.email?.[0]?.toUpperCase() ||
                "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight text-foreground/90">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] text-muted-foreground/60 truncate leading-tight">
              {user?.email}
            </p>
          </div>
          <ModeToggle />
        </div>

        <TooltipProvider delayDuration={300}>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-0.5 bg-muted/40 rounded-xl p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/wallet" onClick={() => isMobile && setOpenMobile(false)}>
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-background/80 transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground hover:scale-105">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Wallet
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/events" onClick={() => isMobile && setOpenMobile(false)}>
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-background/80 transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground hover:scale-105">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Events
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/settings" onClick={() => isMobile && setOpenMobile(false)}>
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-background/80 transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground hover:scale-105">
                      <Settings className="h-4 w-4" />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Settings
                </TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-all duration-200 cursor-pointer text-muted-foreground hover:text-destructive hover:scale-105"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Logout
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
