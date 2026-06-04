import { cn } from "@/lib/utils";

function Progress({ value = 0, className, indicatorClassName, ...props }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative h-2 overflow-hidden rounded-full bg-secondary", className)} {...props}>
      <div
        className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </div>
  );
}

export { Progress };
