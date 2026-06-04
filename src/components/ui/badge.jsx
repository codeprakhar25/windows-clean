import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        safe: "border-emerald-200 bg-emerald-50 text-emerald-700",
        rebuildable: "border-sky-200 bg-sky-50 text-sky-700",
        review: "border-amber-200 bg-amber-50 text-amber-800",
        advanced: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
        restricted: "border-red-200 bg-red-50 text-red-700",
        advisory: "border-zinc-200 bg-zinc-50 text-zinc-700"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
