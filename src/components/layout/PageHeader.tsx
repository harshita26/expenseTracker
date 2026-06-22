import { type ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
