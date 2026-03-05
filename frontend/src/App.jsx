import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Login from './pages/Login.jsx';
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Personalisation from './pages/Personalisation.jsx'
import LandingPage from './pages/LandingPage.jsx';
import AdminDashboard from "./pages/AdminDashboard.jsx";
export default function App() {
  return (
    <Router>

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path='/dashboard' element={<Dashboard/>}></Route>
        <Route path='/personalisation' element={<Personalisation/>}></Route>
        <Route path='/admin' element={<AdminDashboard/>}></Route>

        <Route path="*" element={<h1>404: Page Not Found</h1>} />
      </Routes>
    </Router>
  );
}
