"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import {
  Loader2,
  HeadphonesIcon,
  Clock,
  Hash,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import ChatWindow from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/PageHeader";

interface Ticket {
  _id: string;
  ticketId: string;
  subject: string;
  status: string;
  createdAt: string;
  conversation: {
    _id: string;
  };
}

export default function UserTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const res = await axios.get(`/api/support/${id}`);
        setTicket(res.data.data);
      } catch (error) {
        toast.error("Failed to load ticket details");
        console.error("Error fetching ticket:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchTicket();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Support"
          icon={<HeadphonesIcon className="h-4 w-4 text-primary" />}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-muted/40 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <h2 className="text-sm font-semibold">Ticket not found</h2>
          <p className="text-xs text-muted-foreground/60">
            This ticket may have been deleted or doesn&apos;t exist.
          </p>
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
            className="rounded-xl cursor-pointer"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const statusColor =
    ticket.status === "open"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : "bg-muted text-muted-foreground border-border/30";

  return (
    <div className="flex flex-col h-screen w-full">
      <PageHeader
        title="Support Chat"
        description={ticket.subject}
        icon={<HeadphonesIcon className="h-4 w-4 text-primary" />}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/settings?tab=support")}
            className="rounded-xl text-xs cursor-pointer h-8"
          >
            All Tickets
          </Button>
        }
      />

      <div className="shrink-0 mx-4 md:mx-6 mt-4 mb-3 bg-card border border-border/30 rounded-2xl p-4 flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground/60 flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {ticket.ticketId}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0 h-5 font-medium uppercase tracking-wider border ${statusColor}`}
            >
              {ticket.status}
            </Badge>
          </div>
          <p className="text-sm font-medium text-foreground mt-1 truncate">
            {ticket.subject}
          </p>
          <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            Opened{" "}
            {new Date(ticket.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 mx-4 md:mx-6 mb-4 border border-border/30 rounded-2xl overflow-hidden relative flex flex-col">
        {ticket.status === "fulfilled" && (
          <div className="bg-muted/40 text-muted-foreground p-2.5 text-center text-xs font-medium border-b border-border/20 shrink-0">
            This ticket has been fulfilled. You can still view the chat history.
          </div>
        )}
        <div className="flex-1 min-h-0 [&>div]:h-full!">
          <ChatWindow conversationId={ticket.conversation._id} />
        </div>
      </div>
    </div>
  );
}
