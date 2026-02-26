import { Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import CreatePayment from "./pages/CreatePayment";
import PaymentDetails from "./pages/PaymentDetails";
import Summary from "./pages/Summary";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<Signup />} />
 <Route path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
      <Route path="/create" element={<CreatePayment />} />
<Route path="/payment/:id" element={<PaymentDetails />} />
<Route path="/summary" element={<Summary />} />
<Route path="/profile" element={<Profile />} />
    </Routes>
  );
}