"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu,
  FileText,
  MessageSquare,
  Users,
  LayoutDashboard,
  BookOpen,
} from "lucide-react";
import { useState } from "react";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/workers", label: "Workers", icon: Users },
  { href: "/guides", label: "Guides", icon: BookOpen },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

const workerLinks = [
  { href: "/guides", label: "Guides", icon: BookOpen },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const links = session?.user?.role === "ADMIN" ? adminLinks : workerLinks;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="p-6 pb-2 text-lg font-bold">ForgeAI</SheetTitle>
        {session?.user?.organizationName && (
          <p className="px-6 text-xs text-muted-foreground mb-4">
            {session.user.organizationName}
          </p>
        )}
        <nav className="px-3 space-y-1">
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
                onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  );
}
