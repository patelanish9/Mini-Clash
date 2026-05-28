"use client";

/*
 * NeonButton — Native-feel button component for Mini Clash.
 *
 * Why a dedicated component?
 * ─────────────────────────────────────────────────────────────────────
 * Mobile browsers impose 3 invisible penalties on plain <button> elements:
 *
 *   1. 300ms tap delay         → Fixed by `touch-action: manipulation` (via .native-btn)
 *   2. Grey tap highlight      → Fixed by `-webkit-tap-highlight-color: transparent`
 *   3. Sub-44px touch targets  → Fixed by enforcing `min-w-[44px] min-h-[44px]`
 *
 * This component bakes all three fixes in + the physical press scale so
 * every button in the app feels like a native iOS/Android control.
 * ─────────────────────────────────────────────────────────────────────
 */

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size    = "sm" | "md" | "lg";

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Renders a full-width block button */
  block?: boolean;
  /** Neon glow color override (hex) — defaults per variant */
  glowColor?: string;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-[#00f3ff] to-[#ff00f0] text-[#06060f] font-black border-transparent " +
    "hover:brightness-110",
  secondary:
    "bg-transparent border border-[#00f3ff44] text-[#00f3ff] font-bold " +
    "hover:bg-[#00f3ff15]",
  danger:
    "bg-transparent border border-red-500/40 text-red-400 font-bold " +
    "hover:bg-red-500/10",
  ghost:
    "bg-transparent border border-[#1e1e40] text-gray-400 font-bold " +
    "hover:border-[#00f3ff33] hover:text-[#e8e8ff]",
};

const SIZE_STYLES: Record<Size, { button: string; text: string }> = {
  sm: { button: "px-3 py-2 rounded-xl min-h-[44px]",      text: "text-xs uppercase tracking-widest" },
  md: { button: "px-5 py-3 rounded-2xl min-h-[44px]",     text: "text-sm uppercase tracking-widest" },
  lg: { button: "px-6 py-4 rounded-2xl min-h-[52px]",     text: "text-base uppercase tracking-widest" },
};

const VARIANT_GLOW: Record<Variant, string> = {
  primary:   "0 0 20px #00f3ff44, 0 0 40px #ff00f022",
  secondary: "0 0 12px #00f3ff22",
  danger:    "0 0 12px #ff000022",
  ghost:     "none",
};

export function NeonButton({
  children,
  variant = "primary",
  size = "md",
  block = false,
  glowColor,
  className = "",
  disabled,
  style,
  ...rest
}: NeonButtonProps) {
  const { button: sizeBtn, text: sizeText } = SIZE_STYLES[size];
  const glowShadow = glowColor
    ? `0 0 20px ${glowColor}44, 0 0 40px ${glowColor}22`
    : VARIANT_GLOW[variant];

  return (
    <button
      /*
       * native-btn (globals.css):
       *   - min-width / min-height: 44px  → iOS HIG tap target standard
       *   - touch-action: manipulation    → kills 300ms double-tap delay
       *   - -webkit-tap-highlight-color: transparent → kills grey flash
       *   - :active { transform: scale(0.93) }  → physical press feedback
       */
      className={[
        "native-btn",           // ← enforces all native-feel rules
        VARIANT_STYLES[variant],
        sizeBtn,
        sizeText,
        block ? "w-full" : "",
        disabled ? "opacity-40 pointer-events-none" : "",
        "transition-all duration-150",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        boxShadow: disabled ? "none" : glowShadow,
        ...style,
      }}
      disabled={disabled}
      aria-disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
