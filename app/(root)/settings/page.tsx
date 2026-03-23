"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Shield,
  AlertTriangle,
  Settings,
  HeadphonesIcon,
  CreditCard as PaymentsIcon,
} from "lucide-react";
import Profile from "@/components/Profile";
import UpdatePassword from "@/components/UpdatePassword";
import DeleteAccount from "@/components/DeleteAccount";
import SupportTab from "@/components/SupportTab";
import BankConnectForm from "@/components/BankConnectForm";

function SettingsTabs() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "profile";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-5">
      <TabsList className="bg-muted/50 flex-wrap p-1 rounded-xl">
        <TabsTrigger
          value="profile"
          className="gap-2 cursor-pointer rounded-lg text-xs font-medium data-[state=active]:shadow-sm transition-all"
        >
          <User className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Profile</span>
        </TabsTrigger>
        <TabsTrigger
          value="security"
          className="gap-2 cursor-pointer rounded-lg text-xs font-medium data-[state=active]:shadow-sm transition-all"
        >
          <Shield className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Security</span>
        </TabsTrigger>
        <TabsTrigger
          value="appearance"
          className="gap-2 cursor-pointer rounded-lg text-xs font-medium data-[state=active]:shadow-sm transition-all"
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Account</span>
        </TabsTrigger>
        <TabsTrigger
          value="support"
          className="gap-2 cursor-pointer rounded-lg text-xs font-medium data-[state=active]:shadow-sm transition-all"
        >
          <HeadphonesIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Support</span>
        </TabsTrigger>
        <TabsTrigger
          value="payments"
          className="gap-2 cursor-pointer rounded-lg text-xs font-medium data-[state=active]:shadow-sm transition-all"
        >
          <PaymentsIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Payments</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-6">
        <Profile />
      </TabsContent>

      <TabsContent value="security" className="space-y-6">
        <Card className="border-border/30 bg-card rounded-2xl animate-in fade-in duration-300">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">
                Security Settings
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground/70">
              Manage your account security and authentication methods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <UpdatePassword />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="appearance" className="space-y-6">
        <Card className="border-destructive/20 bg-destructive/5 rounded-2xl animate-in fade-in duration-300">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </div>
              <CardTitle className="text-base font-semibold text-destructive">
                Danger Zone
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-destructive/60">
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Delete Account
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Permanently delete your account and all data
                </p>
              </div>
              <DeleteAccount />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="support" className="space-y-6">
        <Card className="border-border/30 bg-card rounded-2xl animate-in fade-in duration-300">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <HeadphonesIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">
                Support Tickets
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground/70">
              Manage your support requests and communicate with our team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SupportTab />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="payments" className="space-y-6">
        <BankConnectForm />
      </TabsContent>
    </Tabs>
  );
}
import { PageHeader } from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <section>
      <PageHeader
        title="Settings"
        description="Manage your account preferences and configurations."
        icon={<Settings className="h-4 w-4 text-primary" />}
      />
      <div className="px-4 py-4 md:px-6 max-w-6xl mx-auto w-full">
        <Suspense
          fallback={
            <div className="animate-pulse h-96 bg-muted/10 rounded-2xl" />
          }
        >
          <SettingsTabs />
        </Suspense>
      </div>
    </section>
  );
}
