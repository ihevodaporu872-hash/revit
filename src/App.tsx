import { lazy, Suspense } from 'react'
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
import CadViewerPage from './components/CadViewer/CadViewerPage'
import N8nStatusPanel from './components/N8nPanel/N8nStatusPanel'

const PdfViewerPage = lazy(() => import('./components/PdfViewer/PdfViewerPage'))
const ExcelViewerPage = lazy(() => import('./components/ExcelViewer/ExcelViewerPage'))

function LoadingFallback() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/converter" replace />} />
        <Route path="/converter" element={<ConverterPage />} />
        <Route path="/cad-viewer" element={<CadViewerPage />} />
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="/pdf" element={<Suspense fallback={<LoadingFallback />}><PdfViewerPage /></Suspense>} />
        <Route path="/excel" element={<Suspense fallback={<LoadingFallback />}><ExcelViewerPage /></Suspense>} />
        <Route path="/cost" element={<CostEstimatePage />} />
        <Route path="/validation" element={<ValidationPage />} />
        <Route path="/ai-analysis" element={<AIAnalysisPage />} />
        <Route path="/project" element={<ProjectMgmtPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/qto" element={<QTOReportsPage />} />
        <Route path="/n8n" element={<N8nStatusPanel />} />
      </Route>
    </Routes>
  )
}
