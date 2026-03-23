"use client";

import { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  redeemTokens,
  fetchBalance,
} from "@/redux/features/wallet/walletSlice";
import Link from "next/link";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { toast } from "sonner";
import { Coins, ArrowRightLeft, Info, Landmark, Loader2 } from "lucide-react";

const TOKEN_RATE_USD = 0.05;
const REDEMPTION_FEE_PERCENT = 0.1;

export default function RedeemForm() {
  const dispatch = useAppDispatch();
  const { balance, isLoading } = useAppSelector((state) => state.wallet);
  const { user } = useAppSelector((state) => state.auth);

  const [amountTokens, setAmountTokens] = useState<string>("");
  const [calculation, setCalculation] = useState({
    gross: 0,
    fee: 0,
    net: 0,
  });

  useEffect(() => {
    const tokens = parseInt(amountTokens) || 0;
    const gross = tokens * TOKEN_RATE_USD;
    const fee = gross * REDEMPTION_FEE_PERCENT;
    const net = gross - fee;
    setCalculation({ gross, fee, net });
  }, [amountTokens]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokens = parseInt(amountTokens);

    if (!tokens || tokens <= 0) {
      toast.error("Please enter a valid amount of tokens.");
      return;
    }

    if (tokens > balance) {
      toast.error("Insufficient token balance.");
      return;
    }

    try {
      await dispatch(redeemTokens({ amountTokens: tokens })).unwrap();
      setAmountTokens("");
      dispatch(fetchBalance());
    } catch (err: any) {
      toast.error(err?.message || "Redemption failed.");
    }
  };

  if (user?.bankAccountStatus !== "verified") {
    return (
      <Card className="border-border/30 bg-muted/20 rounded-2xl">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center">
            <Landmark className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-base text-foreground">
              Account Not Verified
            </h3>
            <p className="text-xs text-muted-foreground/70 max-w-sm">
              You need a verified bank account to redeem tokens. Please connect
              your bank account in the Settings &gt; Payments tab.
            </p>
          </div>
          <Link href="/settings">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl cursor-pointer gap-1.5 text-xs"
            >
              Go to Settings
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative border-border/30 bg-card overflow-hidden rounded-2xl">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-primary via-primary/70 to-primary/30" />
      <CardHeader className="pb-1">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
          </div>
          <CardTitle className="text-base font-semibold">
            Redeem Tokens
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground/70 mt-1">
          Convert your tokens into USD and withdraw to your bank account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-2">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label
              htmlFor="tokens"
              className="text-xs font-medium text-muted-foreground/80"
            >
              Amount of Tokens
            </Label>
            <span className="text-[11px] text-muted-foreground/60 tabular-nums">
              Balance: {balance.toLocaleString()}
            </span>
          </div>
          <div className="relative">
            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              id="tokens"
              type="number"
              placeholder="0"
              className="pl-9 h-10 rounded-xl bg-muted/40 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-colors"
              value={amountTokens}
              onChange={(e) => setAmountTokens(e.target.value)}
              min="1"
              max={balance}
            />
          </div>
        </div>

        {calculation.gross > 0 && (
          <div className="space-y-2.5 p-4 rounded-xl bg-primary/5 border border-primary/10 animate-in fade-in duration-300">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground/70">Rate:</span>
              <span className="font-medium tabular-nums">
                1 Token = ${TOKEN_RATE_USD}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground/70">Gross Amount:</span>
              <span className="font-medium tabular-nums">
                ${calculation.gross.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground/70">
                Platform Fee (10%):
              </span>
              <span className="font-medium text-rose-500 tabular-nums">
                - ${calculation.fee.toFixed(2)}
              </span>
            </div>
            <div className="pt-2.5 border-t border-primary/10 flex justify-between items-center">
              <span className="text-sm font-semibold">You Receive:</span>
              <span className="text-lg font-bold text-primary tabular-nums">
                ${calculation.net.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 items-start p-3 rounded-xl bg-muted/40 text-[11px] text-muted-foreground/60">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Redemptions are processed via Stripe Connect. Funds typically reach
            your bank account within 3-7 business days after approval.
          </p>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border/10 bg-muted/10 px-6 py-4">
        <Button
          className="w-full cursor-pointer rounded-xl h-10 font-medium shadow-sm gap-2"
          onClick={handleRedeem}
          disabled={isLoading || !amountTokens || calculation.net <= 0}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRightLeft className="h-4 w-4" />
          )}
          {isLoading ? "Processing..." : "Redeem Now"}
        </Button>
      </CardFooter>
    </Card>
  );
}
