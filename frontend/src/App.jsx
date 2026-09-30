import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { MonitoringProvider } from './context/MonitoringContext';
import Login from './pages/Login';
import Register from './pages/Register';
import LiveMonitoring from './pages/LiveMonitoring';
import DetectionHistory from './pages/DetectionHistory';
import DetectionDetails, { EventPlaceholder } from './pages/DetectionDetails';

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <p className="font-script text-[40px] text-ink">Page not found</p>
      <Link to="/" className="pill">
        Back to the camera →
      </Link>
    </div>
  );
}

// Folder tabs: Live Camera (first page) · Detection Log · Event Details
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <MonitoringProvider>
              <Layout />
            </MonitoringProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/camera" replace />} />
        <Route path="camera" element={<LiveMonitoring />} />
        <Route path="log" element={<DetectionHistory />} />
        <Route path="event" element={<EventPlaceholder />} />
        <Route path="event/:id" element={<DetectionDetails />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
