import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-[12px] bg-surface px-4 text-base text-ink shadow-[0_0_0_1px_rgba(42,24,16,0.12)] placeholder:text-faint",
        "transition-[box-shadow] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(177,50,34,0.35)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-[16px] bg-surface px-4 py-3 text-base text-ink shadow-[0_0_0_1px_rgba(42,24,16,0.12)] placeholder:text-faint",
        "transition-[box-shadow] duration-150 ease-out resize-none",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(177,50,34,0.35)]",
        className,
      )}
      {...props}
    />
  );
}
