import Navbar from "../components/Navbar";
import PaymentTable from "../components/PaymentTable";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export default function Dashboard() {
  const [transactions, setTransactions] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sample = [
      { id: "PAY201", amount: 500, currency: "USD", status: "SUCCESS", createdAt: new Date() },
      { id: "PAY202", amount: 900, currency: "INR", status: "FAILED", createdAt: new Date() },
      { id: "PAY203", amount: 1200, currency: "USD", status: "SUCCESS", createdAt: new Date() },
      { id: "PAY204", amount: 300, currency: "EUR", status: "PROCESSING", createdAt: new Date() },
      { id: "PAY205", amount: 700, currency: "USD", status: "SUCCESS", createdAt: new Date() },
    ];
    setTransactions(sample);
  }, []);

  if (!transactions) return null;

  const total = transactions.length;
  const success = transactions.filter(t => t.status === "SUCCESS").length;
  const failed = transactions.filter(t => t.status === "FAILED").length;
  const processing = transactions.filter(t => t.status === "PROCESSING").length;

  const pieData = [
    { name: "Success", value: success },
    { name: "Failed", value: failed },
    { name: "Processing", value: processing },
  ];

  const COLORS = ["#22c55e", "#ef4444", "#eab308"];

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-gray-950 text-white p-10 space-y-10">

        {/* Title */}
        <h2 className="text-3xl font-bold">Dashboard</h2>

        {/* Stat Cards */}
        <div className="grid md:grid-cols-4 gap-6">
          <StatCard title="Total Payments" value={total} icon={<CreditCard />} />
          <StatCard title="Successful" value={success} icon={<CheckCircle />} color="green" />
          <StatCard title="Failed" value={failed} icon={<XCircle />} color="red" />
          <StatCard title="Processing" value={processing} icon={<Clock />} color="yellow" />
        </div>

        {/* Chart + Action */}
        <div className="grid md:grid-cols-2 gap-10">

          {/* Chart */}
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="mb-4 font-semibold">Payment Status</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" outerRadius={90}>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold mb-2">Quick Actions</h3>
              <p className="text-gray-400 text-sm">
                Create and manage payments quickly.
              </p>
            </div>

            <button
              onClick={() => navigate("/create")}
              className="mt-6 bg-indigo-600 hover:bg-indigo-500 transition px-6 py-3 rounded-lg"
            >
              + Create Payment
            </button>
          </div>
        </div>

        {/* Recent Transactions */}
        <PaymentTable transactions={transactions} />

      </div>
    </>
  );
}

function StatCard({ title, value, icon, color }) {
  const colorMap = {
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 flex justify-between items-center">
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <div className={`w-10 h-10 flex items-center justify-center ${colorMap[color] || "text-indigo-400"}`}>
        {icon}
      </div>
    </div>
  );
}