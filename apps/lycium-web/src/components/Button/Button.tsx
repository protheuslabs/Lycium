import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

type ButtonVariant = "standard" | "nav" | "icon" | "complete";
type ButtonTone = "neutral" | "positive" | "negative";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  selected?: boolean;
  iconOnly?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  children,
  className = "",
  variant = "standard",
  tone = "neutral",
  selected = false,
  iconOnly = false,
  type = "button",
  ...props
}: ButtonProps, ref) {
  const classes = [
    "lycium-button",
    `lycium-button-${variant}`,
    `lycium-button-tone-${tone}`,
    selected ? "lycium-button-selected" : "",
    iconOnly ? "lycium-button-icon-only" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button ref={ref} className={classes} type={type} {...props}>
      {children}
    </button>
  );
});

export default Button;
