"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  getTransactions,
  clearAdminState,
} from "@/redux/features/admin/adminSlice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowRightLeft,
  CreditCard,
  Search,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ManageTransactions() {
  const dispatch = useAppDispatch();
  const {
    transactions,
    isTransactionsLoading,
    error,
    transactionsPage,
    transactionsTotalPages,
  } = useAppSelector((state) => state.admin);

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    dispatch(getTransactions({ page, limit: 20, search: debouncedSearch }));
  }, [dispatch, page, debouncedSearch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearAdminState());
    }
  }, [error, dispatch]);

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < transactionsTotalPages) setPage(page + 1);
  };

  if (isTransactionsLoading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return <CreditCard className="h-4 w-4 mr-2" />;
      case "transfer_sent":
      case "transfer_received":
        return <ArrowRightLeft className="h-4 w-4 mr-2" />;
      default:
        return null;
    }
  };

  const getTransactionBadgeVariant = (type: string) => {
    switch (type) {
      case "purchase":
        return "default";
      case "transfer_received":
        return "secondary";
      case "transfer_sent":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex-1 w-full">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" /> All Transactions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and review token purchases and transfers.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {!transactions || transactions.length === 0 ? (
        <Card className="bg-card/30 border-dashed border-2 py-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowRightLeft className="h-8 w-8 text-primary opacity-80" />
            </div>
            <h3 className="text-lg font-medium mb-1">No transactions found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {debouncedSearch
                ? "Try adjusting your search query to find what you're looking for."
                : "No matching transactions have occurred yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-sm overflow-hidden bg-card/40 backdrop-blur-sm py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="font-medium h-12">Date</TableHead>
                  <TableHead className="font-medium h-12">User</TableHead>
                  <TableHead className="font-medium h-12">Type</TableHead>
                  <TableHead className="font-medium h-12">Details</TableHead>
                  <TableHead className="text-right font-medium h-12">
                    Amount
                  </TableHead>
                  <TableHead className="text-right font-medium h-12">
                    Balance
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction: any) => (
                  <TableRow
                    key={transaction._id}
                    className="hover:bg-muted/30 transition-colors border-border/40 group"
                  >
                    <TableCell className="py-3 whitespace-nowrap text-muted-foreground text-sm">
                      {new Date(transaction.createdAt).toLocaleString(
                        undefined,
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {transaction.user ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground/90 leading-tight">
                            {transaction.user.firstName}{" "}
                            {transaction.user.lastName}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {transaction.user.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-sm">
                          Unknown User
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant={getTransactionBadgeVariant(transaction.type)}
                        className="flex items-center w-fit px-2 py-1 font-medium tracking-wide shadow-none"
                      >
                        {getTransactionIcon(transaction.type)}
                        <span className="capitalize">
                          {transaction.type.replace("_", " ")}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      {transaction.type === "purchase" && transaction.plan && (
                        <span className="text-sm font-medium">
                          Plan: {transaction.plan.name}
                          {transaction.amountMoney && (
                            <span className="text-muted-foreground ml-1.5 font-normal">
                              (${transaction.amountMoney / 100})
                            </span>
                          )}
                        </span>
                      )}
                      {transaction.type === "transfer_sent" &&
                        transaction.toUser && (
                          <div className="flex items-center text-sm text-muted-foreground gap-1.5">
                            To:{" "}
                            <span className="font-medium text-foreground/80">
                              {transaction.toUser.firstName}{" "}
                              {transaction.toUser.lastName}
                            </span>
                          </div>
                        )}
                      {transaction.type === "transfer_received" &&
                        transaction.fromUser && (
                          <div className="flex items-center text-sm text-muted-foreground gap-1.5">
                            From:{" "}
                            <span className="font-medium text-foreground/80">
                              {transaction.fromUser.firstName}{" "}
                              {transaction.fromUser.lastName}
                            </span>
                          </div>
                        )}
                    </TableCell>
                    <TableCell className="py-3 text-right font-semibold">
                      <div
                        className={`flex items-center justify-end gap-1 ${
                          transaction.type === "transfer_sent"
                            ? "text-rose-500"
                            : "text-emerald-500"
                        }`}
                      >
                        {transaction.type === "transfer_sent" ? "-" : "+"}
                        <Coins className="h-3.5 w-3.5 opacity-80" />
                        {transaction.amount.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right text-muted-foreground font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <Coins className="h-3 w-3 opacity-50" />
                        {transaction.balanceAfter.toLocaleString()}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {transactionsTotalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground font-medium">
            Page {transactionsPage} of {transactionsTotalPages}
          </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={page === 1 || isTransactionsLoading}
              className="bg-card/40 hover:bg-muted border-border/50 shadow-sm cursor-pointer"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={
                page === transactionsTotalPages || isTransactionsLoading
              }
              className="bg-card/40 hover:bg-muted border-border/50 shadow-sm cursor-pointer"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
