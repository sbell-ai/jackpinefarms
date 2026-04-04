import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  leftIcon?: React.ReactNode;
  variant?: "default" | "farmops";
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ leftIcon, variant = "default", className, ...props }, ref) => {
    const [show, setShow] = useState(false);

    const toggleClass =
      variant === "farmops"
        ? "absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
        : "absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors";

    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={show ? "text" : "password"}
          className={className}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className={toggleClass}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
