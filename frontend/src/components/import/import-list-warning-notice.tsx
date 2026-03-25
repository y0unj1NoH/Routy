import { TriangleAlert } from "lucide-react";

import { UI_COPY } from "@/constants/ui-copy";

export function ImportListWarningNotice() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-warning">
      <TriangleAlert className="h-4 w-4 shrink-0 self-center" aria-hidden="true" />
      <p className="break-keep text-xs font-medium leading-5">{UI_COPY.importListModal.warning}</p>
    </div>
  );
}
