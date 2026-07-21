import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

export function Card({ children, className = "", interactive = false, ...props }: CardProps) {
  return (
    <div
      className={`glass-card ${interactive ? "glass-card-interactive" : ""} p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col space-y-1.5 mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold text-slate-100 tracking-tight ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-slate-400 ${className}`}>{children}</p>;
}

export function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
