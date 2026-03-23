"use client";

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  transferTokens,
  fetchBalance,
  clearWalletState,
} from "@/redux/features/wallet/walletSlice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Coins, Loader2, Send, Wallet } from "lucide-react";

interface SendTokensModalProps {
  recipientId: string;
  recipientName: string;
  children: React.ReactNode;
}

export default function SendTokensModal({
  recipientId,
  recipientName,
  children,
}: SendTokensModalProps) {
  const dispatch = useAppDispatch();
  const { balance, isLoading } = useAppSelector((state) => state.wallet);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      dispatch(fetchBalance());
    }
  };

  const handleSend = async () => {
    const tokenAmount = parseInt(amount);
    if (!tokenAmount || tokenAmount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (tokenAmount > (balance ?? 0)) {
      toast.error("Insufficient balance.");
      return;
    }

    try {
      await dispatch(
        transferTokens({
          toUserId: recipientId,
          amount: tokenAmount,
          note,
        }),
      ).unwrap();
      toast.success(`Sent ${tokenAmount} tokens to ${recipientName}!`);
      setAmount("");
      setNote("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Transfer failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-border/40">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Coins className="h-4 w-4 text-primary" />
            </div>
            Send Tokens
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/70 mt-0.5">
            Send tokens to <strong>{recipientName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/30 p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground">
                Your Balance
              </span>
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {(balance ?? 0).toLocaleString()} tokens
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground/80">
              Amount
            </label>
            <Input
              type="number"
              placeholder="Enter token amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              max={balance ?? 0}
              className="h-10 rounded-xl bg-muted/40 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground/80">
              Note (optional)
            </label>
            <Input
              placeholder="Add a note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 rounded-xl bg-muted/40 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-colors"
            />
          </div>
        </div>

        <DialogFooter className="px-5 py-4 border-t border-border/10 bg-muted/20">
          <Button
            onClick={handleSend}
            disabled={isLoading || !amount || parseInt(amount) <= 0}
            className="w-full h-10 rounded-xl font-medium shadow-sm cursor-pointer gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isLoading ? "Sending..." : `Send ${amount || 0} Tokens`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
