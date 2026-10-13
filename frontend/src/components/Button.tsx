import React from "react";

export function Button({
  children,
  onClick,
  secondary = false,
  ghost = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  ghost?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn ${secondary ? "secondary" : ghost ? "ghost" : "primary"}`}
    >
      {children}
    </button>
  );
}
