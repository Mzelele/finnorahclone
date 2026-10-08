import clsx from "clsx";

export default function OpenCart({
  className,
  quantity,
  navbarDark,
}: {
  className?: string;
  quantity?: number;
  navbarDark?: boolean;
}) {
  return (
    <div className={clsx("relative flex h-10 w-10 items-center justify-center rounded-md transition-colors md:h-12 md:w-12", navbarDark ? "border-neutral-700 text-white" : "border-neutral-200 text-neutral-900", className)}>
          <svg className="h-6 w-6 md:h-7 md:w-7" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
      </svg>

      {quantity ? (
        <div className="absolute right-0 top-0 -mr-1.5 -mt-1.5 flex h-4 w-4 items-center justify-center rounded-sm bg-red-600 text-[10px] font-medium text-white md:-mr-2 md:-mt-2 md:text-[11px]">
          {quantity}
        </div>
      ) : null}
    </div>
  );
}

