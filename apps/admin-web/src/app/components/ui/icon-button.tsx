import { forwardRef, type ButtonHTMLAttributes } from 'react';

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function IconButton({ className = '', type = 'button', ...props }, ref) {
  return (
    <button
      type={type}
      ref={ref}
      className={`inline-flex size-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 ${className}`}
      {...props}
    />
  );
});
