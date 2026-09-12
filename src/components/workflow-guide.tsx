"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface WorkflowStep {
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "secondary" | "success" | "warning" | "destructive" | "info" | "outline";
}

export interface WorkflowGuideProps {
  moduleKey: "M07" | "M09" | "M10";
  title: string;
  subtitle: string;
  steps: WorkflowStep[];
  tip?: string;
  defaultExpanded?: boolean;
}

export function WorkflowGuide({
  title,
  subtitle,
  steps,
  tip,
  defaultExpanded = false
}: WorkflowGuideProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background shadow-sm transition-all duration-200">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
                <Badge variant="outline" className="text-[10px] font-normal uppercase tracking-wider">
                  Process & Workflow
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <span>{expanded ? "Hide Guide" : "View Process"}</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {expanded ? (
          <div className="mt-4 border-t pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, idx) => (
                <div
                  key={step.title}
                  className="relative rounded-lg border bg-card/60 p-3.5 text-xs transition-shadow hover:shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {idx + 1}
                    </span>
                    {step.badge ? (
                      <Badge variant={step.badgeVariant ?? "secondary"} className="text-[10px] px-1.5 py-0">
                        {step.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">{step.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
            {tip ? (
              <div className="mt-3.5 flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <span className="shrink-0 font-medium text-foreground">💡 Pro-tip:</span>
                <span>{tip}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
