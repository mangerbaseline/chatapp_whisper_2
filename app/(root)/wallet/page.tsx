"use client";

import { Suspense } from "react";
import Wallet from "@/components/Wallet";
import { PageHeader } from "@/components/PageHeader";
import { Wallet as WalletIcon } from "lucide-react";

export default function WalletPage() {
  return (
    <div>
      <PageHeader
        title="Wallet"
        description="Manage your tokens, purchases, and redemptions."
        icon={<WalletIcon className="h-4 w-4 text-primary" />}
      />
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <Wallet />
      </Suspense>
    </div>
  );
}
