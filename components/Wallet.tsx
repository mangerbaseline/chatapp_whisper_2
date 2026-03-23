"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  fetchHistory,
  createCheckoutSession,
  verifyPurchase,
  clearWalletState,
  fetchBalance,
  fetchPlans,
  redeemTokens,
} from "@/redux/features/wallet/walletSlice";
import RedeemForm from "./RedeemForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Coins,
  CreditCard,
  Send,
  ArrowDownToLine,
  History,
  Loader2,
  ArrowRightLeft,
  Sparkles,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Wallet as WalletIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Wallet() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const {
    balance,
    plans,
    transactions,
    totalPages,
    currentPage,
    isLoading,
    error,
    successMessage,
  } = useAppSelector((state) => state.wallet);

  const [activeTab, setActiveTab] = useState("buy");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchBalance());
    dispatch(fetchPlans());
    dispatch(fetchHistory({ page: 1 }));
  }, [dispatch]);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      dispatch(verifyPurchase(sessionId)).then(() => {
        dispatch(fetchBalance());
        dispatch(fetchHistory({ page: 1 }));
      });
      window.history.replaceState({}, "", "/wallet");
    }
  }, [searchParams, dispatch]);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
      dispatch(clearWalletState());
    }
  }, [successMessage, dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearWalletState());
    }
  }, [error, dispatch]);

  const handleBuyTokens = async (planId: string) => {
    setLoadingPlanId(planId);
    try {
      const result = await dispatch(createCheckoutSession(planId)).unwrap();
      if (result?.url) {
        window.location.href = result.url;
      }
    } finally {
      setLoadingPlanId(null);
    }
  };

  const formatCurrency = (amount: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case "transfer_sent":
        return <Send className="h-4 w-4 text-rose-500" />;
      case "transfer_received":
        return <ArrowDownToLine className="h-4 w-4 text-emerald-500" />;
      case "redemption":
        return <ArrowRightLeft className="h-4 w-4 text-primary" />;
      default:
        return <Coins className="h-4 w-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "purchase":
        return "Purchased";
      case "transfer_sent":
        return "Sent";
      case "transfer_received":
        return "Received";
      case "redemption":
        return "Redeemed";
      default:
        return type;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
      <Card className="relative overflow-hidden border-primary/20 bg-linear-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        <CardHeader className="pb-1 relative">
          <CardDescription className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <WalletIcon className="h-3.5 w-3.5 text-primary" />
            </div>
            Token Balance
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight tabular-nums">
              {(balance ?? 0).toLocaleString()}
            </span>
            <span className="text-base font-medium text-muted-foreground/60">
              tokens
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full h-11 rounded-xl bg-muted/60 p-1">
          <TabsTrigger
            value="buy"
            className="cursor-pointer rounded-lg text-xs font-medium data-[state=active]:shadow-sm transition-all"
          >
            <CreditCard className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Buy
          </TabsTrigger>
          <TabsTrigger
            value="redeem"
            className="cursor-pointer rounded-lg text-xs font-medium data-[state=active]:shadow-sm transition-all"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Redeem
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="cursor-pointer rounded-lg text-xs font-medium data-[state=active]:shadow-sm transition-all"
          >
            <History className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buy" className="space-y-4 mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight">
              Choose a Plan
            </h3>
            <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Instant delivery
            </span>
          </div>

          {isLoading && plans.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan, index) => (
                <Card
                  key={plan._id}
                  className={cn(
                    "relative overflow-hidden group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-border/40 rounded-2xl",
                    index === 1 && "border-primary/30 shadow-md",
                  )}
                >
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-primary via-primary/70 to-primary/30" />
                  {index === 1 && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-full">
                        Popular
                      </span>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      {plan.name}
                    </CardTitle>
                    {plan.description && (
                      <CardDescription className="text-xs">
                        {plan.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold tracking-tight">
                        {formatCurrency(plan.price, plan.currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Coins className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold text-foreground">
                        {plan.tokens.toLocaleString()}
                      </span>
                      tokens
                    </div>
                    <Button
                      className="w-full cursor-pointer rounded-xl h-9 text-xs font-medium gap-1.5 shadow-sm"
                      onClick={() => handleBuyTokens(plan._id)}
                      disabled={loadingPlanId === plan._id || isLoading}
                    >
                      {loadingPlanId === plan._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <CreditCard className="h-3.5 w-3.5" />
                          Buy Now
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {plans.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <Coins className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground/60">
                No plans available at the moment.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="redeem" className="mt-5">
          <RedeemForm />
        </TabsContent>
        <TabsContent value="history" className="space-y-3 mt-5">
          {isLoading && transactions.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground/60">
                No transactions yet.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {transactions.map((tx) => (
                <div
                  key={tx._id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border/30 bg-card hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight">
                        {getTransactionLabel(tx.type)}
                        {tx.type === "transfer_sent" && tx.toUser
                          ? ` to ${tx.toUser.firstName || tx.toUser.email}`
                          : ""}
                        {tx.type === "transfer_received" && tx.fromUser
                          ? ` from ${tx.fromUser.firstName || tx.fromUser.email}`
                          : ""}
                        {tx.type === "purchase" && tx.plan
                          ? ` — ${tx.plan.name}`
                          : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ·{" "}
                        {new Date(tx.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      tx.type === "transfer_sent" || tx.type === "redemption"
                        ? "text-rose-500"
                        : "text-emerald-500",
                    )}
                  >
                    {tx.type === "transfer_sent" || tx.type === "redemption"
                      ? "-"
                      : "+"}
                    {tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg cursor-pointer"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      dispatch(fetchHistory({ page: currentPage - 1 }))
                    }
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
                    onClick={() =>
                      dispatch(fetchHistory({ page: currentPage + 1 }))
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
