import Link from "next/link";

import { UI_COPY } from "@/constants/ui-copy";
import { Mascot } from "@/components/layout/mascot";
import { PageContainer } from "@/components/layout/page-container";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <PageContainer className="grid min-h-[60dvh] place-items-center">
      <Card className="w-full max-w-xl space-y-4 p-8 text-center">
        <div className="flex justify-center">
          <Mascot variant="surprise" className="h-28 w-28" />
        </div>
        <p className="text-sm font-bold tracking-[0.12em] text-foreground/60">{UI_COPY.systemPages.notFound.eyebrow}</p>
        <h1 className="text-3xl font-black">{UI_COPY.systemPages.notFound.title}</h1>
        <p className="text-sm text-foreground/70">{UI_COPY.systemPages.notFound.description}</p>
        <div className="pt-2">
          <Link href="/" className={buttonStyles({ className: "min-w-44 px-5 font-semibold" })}>
            {UI_COPY.systemPages.notFound.action}
          </Link>
        </div>
      </Card>
    </PageContainer>
  );
}
