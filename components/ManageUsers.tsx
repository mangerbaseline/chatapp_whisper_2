"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  getUsers,
  deleteUser,
  updateUserStatus,
  clearAdminState,
} from "@/redux/features/admin/adminSlice";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Loader2,
  Clock,
  Eye,
  Search,
  Users,
  MoreHorizontal,
  Power,
  PowerOff,
} from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export default function ManageUsers() {
  const dispatch = useAppDispatch();
  const {
    users,
    isLoading,
    error,
    successMessage,
    usersPage,
    usersTotalPages,
  } = useAppSelector((state) => state.admin);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

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
    dispatch(getUsers({ page, limit: 20, search: debouncedSearch }));
  }, [dispatch, page, debouncedSearch]);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
      dispatch(clearAdminState());
      dispatch(getUsers({ page, limit: 20, search: debouncedSearch }));
    }
  }, [successMessage, dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearAdminState());
    }
  }, [error, dispatch]);

  const handleDeleteUser = async (userId: string) => {
    setDeletingId(userId);
    try {
      await dispatch(deleteUser(userId)).unwrap();
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (user: any) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleUpdateStatus = async (userId: string, currentStatus: boolean) => {
    setStatusUpdatingId(userId);
    try {
      await dispatch(
        updateUserStatus({ userId, isActive: !currentStatus }),
      ).unwrap();
    } finally {
      setStatusUpdatingId(null);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No users found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex-1 w-full">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Manage Users
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View, search, and manage registered users.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {!users || users.length === 0 ? (
        <Card className="bg-card/30 border-dashed border-2 py-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary opacity-80" />
            </div>
            <h3 className="text-lg font-medium mb-1">No users found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {debouncedSearch
                ? "Try adjusting your search query."
                : "No users have registered yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-sm overflow-hidden bg-card/40 backdrop-blur-sm py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="font-medium h-12">User</TableHead>
                  <TableHead className="font-medium h-12">Role</TableHead>
                  <TableHead className="font-medium h-12">Status</TableHead>
                  <TableHead className="font-medium h-12">Activity</TableHead>
                  <TableHead className="font-medium h-12">Tickets</TableHead>
                  <TableHead className="text-right font-medium h-12">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => (
                  <TableRow
                    key={user._id}
                    className="hover:bg-muted/30 transition-colors border-border/40 group"
                  >
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground/90 leading-tight">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant={
                          user.role === "ADMIN" ? "default" : "secondary"
                        }
                        className="shadow-none"
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="secondary"
                        className={
                          user.isActive
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium shadow-none tracking-wide"
                            : "bg-muted text-muted-foreground border-border/50 font-medium shadow-none tracking-wide"
                        }
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant="outline"
                              className={
                                user.isDeactivated
                                  ? "border-red-500/30 text-red-600 bg-red-500/10 shadow-none font-medium"
                                  : "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 shadow-none font-medium"
                              }
                            >
                              <Clock className="h-3 w-3 mr-1.5 opacity-70" />
                              {user.isDeactivated ? "Deactivated" : "Active"}
                              {!user.isDeactivated &&
                              user.consecutiveLoginDays > 0
                                ? ` (${user.consecutiveLoginDays}d)`
                                : ""}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Auto-tracked based on login activity</p>
                            <p className="text-xs">
                              Users are deactivated after 45 days of no login
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge
                          variant="outline"
                          className="shadow-none text-muted-foreground"
                        >
                          {user.totalTickets || 0}
                        </Badge>
                        <Link
                          href={`/dashboard/admin-tickets?userId=${user._id}`}
                        >
                          <span className="text-[11px] text-primary/80 hover:text-primary hover:underline cursor-pointer transition-colors">
                            View Tickets
                          </span>
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-40 bg-card/95 backdrop-blur-xl border-border/50"
                        >
                          <Link href={`/dashboard/admin-users/${user._id}`}>
                            <DropdownMenuItem className="cursor-pointer gap-2 focus:bg-primary/10 transition-colors">
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                              View Details
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.preventDefault();
                              if (statusUpdatingId !== user._id) {
                                await handleUpdateStatus(
                                  user._id,
                                  user.isActive,
                                );
                              }
                            }}
                            disabled={statusUpdatingId === user._id}
                            className="cursor-pointer gap-2 focus:bg-primary/10 transition-colors"
                          >
                            {statusUpdatingId === user._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : user.isActive ? (
                              <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <Power className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {user.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border/40" />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              if (deletingId !== user._id) {
                                confirmDelete(user);
                              }
                            }}
                            disabled={deletingId === user._id}
                            className="text-destructive focus:bg-destructive/10 cursor-pointer gap-2 transition-colors"
                          >
                            {deletingId === user._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {usersTotalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground font-medium">
            Page {usersPage} of {usersTotalPages}
          </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (page > 1) setPage(page - 1);
              }}
              disabled={page === 1 || isLoading}
              className="bg-card/40 hover:bg-muted border-border/50 shadow-sm cursor-pointer"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (page < usersTotalPages) setPage(page + 1);
              }}
              disabled={page === usersTotalPages || isLoading}
              className="bg-card/40 hover:bg-muted border-border/50 shadow-sm cursor-pointer"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Global Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {userToDelete?.firstName} {userToDelete?.lastName}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && handleDeleteUser(userToDelete._id)}
              disabled={deletingId === userToDelete?._id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {deletingId === userToDelete?._id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
