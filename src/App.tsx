import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import ConverterPage from './components/Converter/ConverterPage'
import ViewerPage from './components/Viewer3D/ViewerPage'
import CostEstimatePage from './components/CostEstimate/CostEstimatePage'
import ValidationPage from './components/Validation/ValidationPage'
import AIAnalysisPage from './components/AIAnalysis/AIAnalysisPage'
import ProjectMgmtPage from './components/ProjectMgmt/ProjectMgmtPage'
import DocumentsPage from './components/Documents/DocumentsPage'
import QTOReportsPage from './components/QTOReports/QTOReportsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/converter" replace />} />
        <Route path="/converter" element={<ConverterPage />} />
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="/cost" element={<CostEstimatePage />} />
        <Route path="/validation" element={<ValidationPage />} />
        <Route path="/ai-analysis" element={<AIAnalysisPage />} />
        <Route path="/project" element={<ProjectMgmtPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/qto" element={<QTOReportsPage />} />
      </Route>
    </Routes>
  )
}
