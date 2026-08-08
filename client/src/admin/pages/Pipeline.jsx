import { useState } from "react";
import { FaColumns, FaListAlt } from "react-icons/fa";
import { PageHeader } from "../components/Ui";
import ContactPipelineView from "../components/pipeline/ContactPipelineView";
import LeadPipelineView from "../components/pipeline/LeadPipelineView";
import { cn } from "../../lib/utils";

const TABS = [
  { key: "sales", label: "Sales Pipeline", hint: "Contact → Requirement → Quotation → Invoice → Payment", icon: FaColumns },
  { key: "leads", label: "Lead Pipeline", hint: "Legacy 16-stage lead board", icon: FaListAlt },
];

export default function Pipeline() {
  const [tab, setTab] = useState("sales");
  const active = TABS.find((t) => t.key === tab);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle={active?.hint}
        action={
          <div className="flex rounded-xl bg-white p-1 shadow-sm">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  tab === t.key ? "bg-primary-gradient text-white" : "text-ink/50 hover:text-ink"
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
        }
      />

      {tab === "sales" ? <ContactPipelineView /> : <LeadPipelineView />}
    </div>
  );
}
