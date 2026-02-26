import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("auth");
    navigate("/signin");
  };

  return (
    <nav className="bg-gray-900 text-white px-8 py-4 flex justify-between">
      <h1 className="font-semibold">Mini Payment Gateway</h1>

      <div className="space-x-6">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/create">Create Payment</Link>
        <Link to="/summary">Summary</Link>
        <Link to="/profile">Profile</Link>
        <button onClick={handleLogout} className="text-red-400">
          Logout
        </button>
      </div>
    </nav>
  );
}