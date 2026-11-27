import { Page, PageSkeleton } from "@/components/ui";

// Shown at once when moving between dashboard pages, while the next page's
// data loads on the server.
export default function DashboardLoading() {
  return (
    <Page>
      <PageSkeleton />
    </Page>
  );
}
