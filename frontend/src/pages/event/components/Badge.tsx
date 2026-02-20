import React from "react";

export default function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${className}`.trim()}>
      {children}
    </span>
  );
}
