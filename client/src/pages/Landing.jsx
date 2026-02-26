import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-gray-950 text-white overflow-hidden">
      
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600 rounded-full blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full blur-3xl opacity-30 translate-x-1/2 translate-y-1/2"></div>

      {/* Navbar */}
      <nav className="relative z-10 flex justify-between items-center px-10 py-6">
        <h1 className="text-xl font-semibold tracking-wide">
          Mini Payment Gateway
        </h1>

        <div className="space-x-6 text-sm">
          <Link to="/signin" className="hover:text-indigo-400 transition">
            Sign In
          </Link>
          <Link
            to="/signup"
            className="bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-500 transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center text-center mt-28 px-6">
        <h2 className="text-5xl md:text-6xl font-bold max-w-4xl leading-tight">
          Simulate Real-World
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            {" "}Payment Workflows
          </span>
        </h2>

        <p className="text-gray-400 mt-6 max-w-2xl text-lg">
          Understand how modern payment gateways handle transaction states,
          failures, retries, fraud checks and refunds.
        </p>

        <div className="mt-10 flex gap-6">
          <Link
            to="/signup"
            className="bg-indigo-600 px-8 py-4 rounded-xl font-medium hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/30"
          >
            Start Simulation
          </Link>

          <Link
            to="/signin"
            className="border border-gray-700 px-8 py-4 rounded-xl hover:bg-gray-800 transition"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Feature Section */}
      <section className="relative z-10 mt-32 px-10">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">

          <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 hover:border-indigo-500 transition">
            <h3 className="text-xl font-semibold mb-4">State-Driven Engine</h3>
            <p className="text-gray-400 text-sm">
              Simulates CREATED → PROCESSING → SUCCESS / FAILED state transitions.
            </p>
          </div>

          <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 hover:border-indigo-500 transition">
            <h3 className="text-xl font-semibold mb-4">Failure Handling</h3>
            <p className="text-gray-400 text-sm">
              Handles invalid amounts, fraud triggers and network failures.
            </p>
          </div>

          <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 hover:border-indigo-500 transition">
            <h3 className="text-xl font-semibold mb-4">Refund & Retry Logic</h3>
            <p className="text-gray-400 text-sm">
              Simulate refund flows and retry failed transactions dynamically.
            </p>
          </div>

        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 mt-32 text-center pb-20">
        <h3 className="text-3xl font-semibold">
          Ready to Explore Payment States?
        </h3>

        <Link
          to="/signup"
          className="inline-block mt-8 bg-indigo-600 px-10 py-4 rounded-xl hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/30"
        >
          Launch Dashboard
        </Link>
      </section>

    </div>
  );
}