import clsx from "clsx";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function Spinner({ size = "md", className, text }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6 border-2",
    md: "h-10 w-10 border-[3px]",
    lg: "h-14 w-14 border-4",
  };

  return (
    <div className={clsx("flex flex-col items-center justify-center gap-3", className)}>
      <div
        className={clsx(
          "animate-spin rounded-full border-blue-600 border-t-transparent",
          sizeClasses[size],
        )}
      />
      {text && (
        <p className="text-sm font-medium text-neutral-500 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

/** Content-area centered spinner — use this in your loading.tsx files */
export function PageSpinner({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full flex-col items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-[4px] border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium text-neutral-500 animate-pulse">
          {text}
        </p>
      </div>
    </div>
  );
}

/** Jumia-style spinning loader with brand ring */
export function BrandSpinner({
  size = "md",
  className,
  text,
}: SpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6 border-2",
    md: "h-10 w-10 border-[3px]",
    lg: "h-14 w-14 border-4",
  };

  return (
    <div className={clsx("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative flex items-center justify-center">
        <div
          className={clsx(
            "animate-spin rounded-full border-blue-200 border-t-blue-600",
            sizeClasses[size],
          )}
        />
        <div
          className={clsx(
            "absolute rounded-full border-2 border-blue-400 border-t-transparent animate-spin",
            size === "sm" ? "h-3 w-3" : size === "md" ? "h-5 w-5" : "h-7 w-7",
          )}
          style={{ animationDirection: "reverse", animationDuration: "0.6s" }}
        />
      </div>
      {text && (
        <p className="text-sm font-medium text-neutral-500 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}
