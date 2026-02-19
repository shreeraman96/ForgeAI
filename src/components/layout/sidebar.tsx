"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  FileText,
  MessageSquare,
  Users,
  LayoutDashboard,
  Video,
  BookOpen,
} from "lucide-react";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/expert-captures", label: "Expert Captures", icon: Video },
  { href: "/admin/workers", label: "Workers", icon: Users },
  { href: "/guides", label: "Guides", icon: BookOpen },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

const workerLinks = [
  { href: "/guides", label: "Guides", icon: BookOpen },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const links = session?.user?.role === "ADMIN" ? adminLinks : workerLinks;

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-muted/30">
      <div className="p-6">
        <Link href="/" className="text-xl font-bold">
          ForgeAI
        </Link>
        {session?.user?.organizationName && (
          <p className="text-xs text-muted-foreground mt-1">
            {session.user.organizationName}
          </p>
        )}
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
