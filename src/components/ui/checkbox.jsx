import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({ checked, disabled, className, ...props }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded border border-primary shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary text-primary-foreground" : "bg-background",
        className
      )}
      {...props}
    >
      {checked ? <Check className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

export { Checkbox };
