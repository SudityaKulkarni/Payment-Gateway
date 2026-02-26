import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem("token");

  if (!isAuth) {
    return <Navigate to="/signin" />;
  }

  return children;
}