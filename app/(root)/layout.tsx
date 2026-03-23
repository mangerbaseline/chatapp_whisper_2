import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <div className="flex flex-1 overflow-hidden h-screen w-full">
        <ChatSidebar />
        <SidebarInset className="flex-1 bg-card">
          <div className="flex flex-1 flex-col h-full overflow-y-auto">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
