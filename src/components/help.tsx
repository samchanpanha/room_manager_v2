"use client";

import { useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/icon";
import { moduleIcon } from "@/lib/icons";
import { MODULE_GUIDE, DRIVERJS_NOTE } from "@/lib/module-guide";
import { NAV } from "@/lib/nav";

/// Tour steps: highlight the shell chrome with data-tour attributes. Each step
/// shows the "what it means" note. Feel free to add steps that target new
/// module screens — see the DRIVER.JS note below.
function menuTour() {
  return driver({
    showProgress: true,
    steps: [
      { element: '[data-tour="menu"]', popover: { title: "Menu", description: "Your working area. It is grouped and searchable." } },
      { element: '[data-tour="brand"]', popover: { title: "Brand", description: "Company logo + legal name, set in Settings → Org profile." } },
      { element: '[data-tour="menu-search"]', popover: { title: "Search", description: "Type to filter menu items across every group instantly." } },
      { element: '[data-tour="menu-group"]', popover: { title: "Groups", description: "Each group bundles related modules. Click the group name to collapse/expand." } },
      { element: '[data-tour="tabs"]', popover: { title: "Tabs", description: "Every page you open becomes a tab, like a browser. Click a tab to switch, × to close, ＋ to open a new Dashboard tab. The Dashboard tab is always pinned." } },
      { element: '[data-tour="header"]', popover: { title: "Header", description: "Theme toggle (dark/light), this help, and sign-out live here." } }
    ]
  });
}

export function HelpCenter() {
  const [guideOpen, setGuideOpen] = useState(false);

  function startTour() {
    const d = menuTour();
    d.drive();
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" title="Play a guided tour of the app chrome (Driver.js)" onClick={startTour}>
          ? Tour
        </Button>
        <Button variant="ghost" size="sm" title="Module guide — what each module is for" onClick={() => setGuideOpen(true)}>
          Guide
        </Button>
      </div>

      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} title="Module guide" description="What each module is for, and how to run a tour." wide>
        <div className="space-y-4">
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{DRIVERJS_NOTE}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {MODULE_GUIDE.map((m) => {
              const exists = NAV.some((g) => g.items.some((i) => i.module === m.key));
              return (
                <div key={m.key} className="rounded-lg border p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Icon name={moduleIcon(m.key)} className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">{m.key}</span> {m.name}
                    {!exists ? <span className="ml-1 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">no nav page</span> : null}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{m.purpose}</p>
                  {m.tips.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                      {m.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Dialog>
    </>
  );
}