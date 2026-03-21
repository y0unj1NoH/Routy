import { Suspense } from "react";
import NewRouteClient from "@/components/routes/new-route-client";

export default function NewRoutePage() {
  return (
    <Suspense fallback={null}>
      <NewRouteClient />
    </Suspense>
  );
}
