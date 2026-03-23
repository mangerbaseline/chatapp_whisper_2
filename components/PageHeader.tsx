"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  icon,
  action,
}: PageHeaderProps) {
  const { state, toggleSidebar, isMobile } = useSidebar();

  const showTrigger = isMobile || state === "collapsed";

  return (
    <div className="sticky top-0 z-20 border-b border-border/30 bg-background/80 backdrop-blur-md px-4 py-3 md:px-6">
      <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          {showTrigger && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 cursor-pointer -ml-1"
            >
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
          )}
          {icon && (
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">
              {title}
            </h1>
            {description && (
              <p className="text-[11px] text-muted-foreground/60 leading-tight">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
