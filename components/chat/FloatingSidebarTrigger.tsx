"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingSidebarTrigger() {
  const { state, toggleSidebar, isMobile } = useSidebar();

  const isHidden = !isMobile && state === "expanded";

  return (
    <div
      className={cn(
        "sticky top-0 left-0 z-30 p-2.5 transition-all duration-300 ease-in-out",
        isHidden
          ? "opacity-0 pointer-events-none h-0 p-0 overflow-hidden"
          : "opacity-100",
      )}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={toggleSidebar}
        className="h-9 w-9 bg-background/90 backdrop-blur-md border-border/40 shadow-md hover:bg-background hover:shadow-lg hover:scale-105 hover:border-primary/30 rounded-xl transition-all duration-200 cursor-pointer"
      >
        <PanelLeft className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    </div>
  );
}
