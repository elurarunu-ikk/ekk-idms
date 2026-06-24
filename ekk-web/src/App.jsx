import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CaptureList from './pages/CaptureList';
import CaptureForm from './pages/CaptureForm';
import EntryDetail from './pages/EntryDetail';
import PendingApprovals from './pages/PendingApprovals';
import ChatPage from './pages/ChatPage';
import Report from './pages/Report';
import CompanyMaster from './pages/CompanyMaster';
import ProjectMaster from './pages/ProjectMaster';
import UserManagement from './pages/UserManagement';
import UserDetail from './pages/users/UserDetail';
import CreateUser from './pages/users/CreateUser';
import GradeSheetImport from './pages/GradeSheetImport';
import ReferenceDataPage from './pages/ReferenceDataPage';
import ResourcesPage from './pages/ResourcesPage';
import MastersPage from './pages/MastersPage';
import BOQRegister from './pages/BOQRegister';
import BOQApprovals from './pages/BOQApprovals';
import BOQMapping from './pages/BOQMapping';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const ProtectedLayout = () => (
  <PrivateRoute>
    <Navbar />
  </PrivateRoute>
);

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<ProtectedLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="captures" element={<CaptureList />} />
        <Route path="captures/new" element={<CaptureForm />} />
        <Route path="captures/:id" element={<EntryDetail />} />
        <Route path="captures/:id/edit" element={<CaptureForm />} />
        <Route path="pending" element={<PendingApprovals />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="report" element={<Report />} />
        <Route path="companies" element={<CompanyMaster />} />
        <Route path="projects" element={<ProjectMaster />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="users/new" element={<CreateUser />} />
        <Route path="users/:id/access" element={<CreateUser />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="boq" element={<BOQRegister />} />
        <Route path="boq/approvals" element={<BOQApprovals />} />
        <Route path="boq/mapping" element={<BOQMapping />} />
        <Route path="grade-sheet" element={<GradeSheetImport />} />
        <Route path="reference-data" element={<ReferenceDataPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="masters" element={<MastersPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;