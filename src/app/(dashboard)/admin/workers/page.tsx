"use client";

import { useState } from "react";
import { WorkerList } from "@/components/workers/worker-list";
import { InviteWorkerDialog } from "@/components/workers/invite-worker-dialog";

export default function WorkersPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team members and send invitations.
          </p>
        </div>
        <InviteWorkerDialog
          onInvited={() => setRefreshTrigger((n) => n + 1)}
        />
      </div>
      <WorkerList refreshTrigger={refreshTrigger} />
    </div>
  );
}
