import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    // Fake auth for hackathon
    if (email && password) {
      localStorage.setItem("auth", "true");
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-10 rounded-xl shadow-sm w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-6">Sign In</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full border rounded-lg p-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full border rounded-lg p-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700">
            Sign In
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500">
          Don’t have an account?{" "}
          <Link to="/signup" className="text-indigo-600">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}