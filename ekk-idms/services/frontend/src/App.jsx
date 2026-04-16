import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CaptureScreen    from './components/CaptureScreen'
import ManualEntry      from './components/ManualEntry'
import DesignMaster     from './components/DesignMaster'
import DisciplineAdmin  from './components/DisciplineAdmin'
import WorkOrderAdmin   from './components/WorkOrderAdmin'
import NwayExport       from './components/NwayExport'
import Login            from './components/Login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/capture"    element={<CaptureScreen />} />
        <Route path="/manual"     element={<ManualEntry />} />
        <Route path="/design"     element={<DesignMaster />} />
        <Route path="/disciplines" element={<DisciplineAdmin />} />
        <Route path="/workorders" element={<WorkOrderAdmin />} />
        <Route path="/export/nway" element={<NwayExport />} />
        <Route path="/"           element={<Navigate to="/capture" />} />
      </Routes>
    </BrowserRouter>
  )
}
