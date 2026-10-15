import { BrowserRouter, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.tsx";
import ImpactReportPage from "./pages/ImpactReportPage.tsx";
import PolicyPage from "./pages/PolicyPage.tsx";
import RoutePlaceholderPage from "./pages/RoutePlaceholderPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/policies/new" element={<RoutePlaceholderPage title="New policy" description="Create a policy by pasting its text and reviewing extracted clauses." />} />
        <Route path="/items" element={<RoutePlaceholderPage title="Operational items" description="Manage the operational items used by hospital departments." />} />
        <Route path="/policies/:policyId" element={<PolicyPage />} />
        <Route path="/policies/:policyId/dependencies" element={<RoutePlaceholderPage title="Dependency review" description="Review proposed dependencies and manage approved connections." />} />
        <Route path="/policies/:policyId/compare" element={<RoutePlaceholderPage title="Version comparison" description="Compare policy versions before running impact analysis." />} />
        <Route path="/impact-runs/:impactRunId" element={<ImpactReportPage />} />
        <Route path="*" element={<RoutePlaceholderPage title="Page not found" description="This address does not match a CareSync page. Return to the dashboard to continue." />} />
      </Routes>
    </BrowserRouter>
  );
}
