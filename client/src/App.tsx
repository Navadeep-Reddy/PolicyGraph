import { BrowserRouter, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.tsx";
import ImpactReportPage from "./pages/ImpactReportPage.tsx";
import PolicyPage from "./pages/PolicyPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/policies/:policyId" element={<PolicyPage />} />
        <Route path="/impact-runs/:impactRunId" element={<ImpactReportPage />} />
      </Routes>
    </BrowserRouter>
  );
}
