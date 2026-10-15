import { BrowserRouter, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.tsx";
import ImpactReportPage from "./pages/ImpactReportPage.tsx";
import PolicyPage from "./pages/PolicyPage.tsx";
import NewPolicyPage from "./pages/NewPolicyPage.tsx";
import ItemsPage from "./pages/ItemsPage.tsx";
import DependenciesPage from "./pages/DependenciesPage.tsx";
import ComparePage from "./pages/ComparePage.tsx";
import RoutePlaceholderPage from "./pages/RoutePlaceholderPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/policies/new" element={<NewPolicyPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/policies/:policyId" element={<PolicyPage />} />
        <Route path="/policies/:policyId/dependencies" element={<DependenciesPage />} />
        <Route path="/policies/:policyId/compare" element={<ComparePage />} />
        <Route path="/impact-runs/:impactRunId" element={<ImpactReportPage />} />
        <Route path="*" element={<RoutePlaceholderPage title="Page not found" description="This address does not match a CareSync page. Return to the dashboard to continue." />} />
      </Routes>
    </BrowserRouter>
  );
}
