"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Coins,
  MoreHorizontal,
  Power,
  PowerOff,
  Search,
} from "lucide-react";

interface Plan {
  _id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  tokens: number;
  isActive: boolean;
  createdBy?: { firstName: string; lastName: string; email: string };
  createdAt: string;
}

export default function ManagePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    currency: "usd",
    tokens: "",
  });

  const fetchPlans = async () => {
    try {
      const res = await axios.get("/api/admin/plans");
      setPlans(res.data.data);
    } catch {
      toast.error("Failed to fetch plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      price: "",
      currency: "usd",
      tokens: "",
    });
    setEditingPlan(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description,
      price: (plan.price / 100).toString(),
      currency: plan.currency,
      tokens: plan.tokens.toString(),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.tokens) {
      toast.error("Name, price, and tokens are required.");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name,
        description: form.description,
        price: Math.round(parseFloat(form.price) * 100),
        currency: form.currency,
        tokens: parseInt(form.tokens),
      };

      if (editingPlan) {
        await axios.patch(`/api/admin/plans/${editingPlan._id}`, data);
        toast.success("Plan updated!");
      } else {
        await axios.post("/api/admin/plans", data);
        toast.success("Plan created!");
      }
      setDialogOpen(false);
      resetForm();
      fetchPlans();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (plan: Plan) => {
    try {
      await axios.patch(`/api/admin/plans/${plan._id}`, {
        isActive: !plan.isActive,
      });
      toast.success(`Plan ${plan.isActive ? "deactivated" : "activated"}!`);
      fetchPlans();
    } catch {
      toast.error("Failed to toggle plan");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/admin/plans/${id}`);
      toast.success("Plan deleted!");
      fetchPlans();
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    } catch {
      toast.error("Failed to delete plan");
    }
  };

  const confirmDelete = (plan: Plan) => {
    setPlanToDelete(plan);
    setDeleteDialogOpen(true);
  };

  const formatCurrency = (amount: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredPlans = plans.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description &&
        p.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex-1 w-full">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Token Plans
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage token plans for users to purchase.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary/20"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={openCreate}
                className="cursor-pointer whitespace-nowrap shadow-sm hover:shadow-md transition-all"
              >
                <Plus className="h-4 w-4 mr-2" /> New Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPlan ? "Edit Plan" : "Create Plan"}
                </DialogTitle>
                <DialogDescription>
                  {editingPlan
                    ? "Update the plan details below."
                    : "Fill in the details to create a new token plan."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan Name</label>
                  <Input
                    placeholder="e.g., Starter Pack"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    placeholder="Optional description"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Price (in USD)
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g., 1 = $1.00"
                      value={form.price}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({
                          ...form,
                          price: val,
                          tokens: val
                            ? Math.floor(parseFloat(val) * 20).toString()
                            : "",
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Currency</label>
                    <Input
                      placeholder="usd"
                      value={form.currency}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tokens</label>
                  <Input
                    type="number"
                    placeholder="Number of tokens user gets"
                    value={form.tokens}
                    onChange={(e) =>
                      setForm({ ...form, tokens: e.target.value })
                    }
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingPlan ? (
                    "Update Plan"
                  ) : (
                    "Create Plan"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredPlans.length === 0 ? (
        <Card className="bg-card/30 border-dashed border-2 py-0">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins className="h-8 w-8 text-primary opacity-80" />
            </div>
            <h3 className="text-lg font-medium mb-1">No plans found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {searchQuery
                ? "Try adjusting your search query."
                : "You haven't created any token plans yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-sm overflow-hidden bg-card/40 backdrop-blur-sm py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="font-medium h-12">
                    Plan Information
                  </TableHead>
                  <TableHead className="font-medium h-12">Pricing</TableHead>
                  <TableHead className="font-medium h-12">
                    Tokens Value
                  </TableHead>
                  <TableHead className="font-medium h-12">Status</TableHead>
                  <TableHead className="text-right font-medium h-12">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.map((plan) => (
                  <TableRow
                    key={plan._id}
                    className="hover:bg-muted/30 transition-colors border-border/40 group"
                  >
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-0.5 max-w-[250px]">
                        <span className="font-semibold text-foreground/90 leading-tight">
                          {plan.name}
                        </span>
                        {plan.description && (
                          <span
                            className="text-[11px] text-muted-foreground truncate"
                            title={plan.description}
                          >
                            {plan.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="font-medium text-foreground/80">
                        {formatCurrency(plan.price, plan.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Coins className="h-4 w-4 text-amber-500/80" />
                        {plan.tokens.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="secondary"
                        className={
                          plan.isActive
                            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 font-medium tracking-wide shadow-none"
                            : "bg-muted text-muted-foreground hover:bg-muted border-border/50 font-medium tracking-wide shadow-none"
                        }
                      >
                        {plan.isActive ? "Active" : "Archived"}
                      </Badge>
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
                          <DropdownMenuItem
                            onClick={() => openEdit(plan)}
                            className="cursor-pointer gap-2 focus:bg-primary/10 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggle(plan)}
                            className="cursor-pointer gap-2 focus:bg-primary/10 transition-colors"
                          >
                            {plan.isActive ? (
                              <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <Power className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {plan.isActive ? "Archive" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border/40" />
                          <DropdownMenuItem
                            onClick={() => confirmDelete(plan)}
                            className="text-destructive focus:bg-destructive/10 cursor-pointer gap-2 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete Plan
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{planToDelete?.name}
              &quot;? This action cannot be undone and users will no longer be
              able to purchase it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planToDelete && handleDelete(planToDelete._id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
