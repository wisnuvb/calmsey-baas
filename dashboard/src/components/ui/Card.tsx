import { ReactNode } from "react";
import { classNames } from "../../lib/utils";
import React from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
}

export default function Card({
  children,
  className,
  title,
  actions,
}: CardProps) {
  return (
    <div
      className={classNames(
        "bg-white rounded-lg shadow-sm border border-gray-200",
        className
      )}
    >
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
