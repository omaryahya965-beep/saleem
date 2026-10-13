import React from "react";
import { Check, TriangleAlert, X } from "lucide-react";

export function StatusChip({
  type,
  children,
}: {
  type: "v" | "w" | "ok";
  children: React.ReactNode;
}) {
  return (
    <span className={`chip ${type}`}>
      {type === "v" ? <X /> : type === "w" ? <TriangleAlert /> : <Check />}
      {children}
    </span>
  );
}
