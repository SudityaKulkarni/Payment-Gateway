import Navbar from "../components/Navbar";
import PaymentTable from "../components/PaymentTable";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useState } from "react";

export default function Summary() {
  const [transactions, setTransactions] = useState(null);

  useEffect(() => {
    setTimeout(() => {
      const sampleTransactions = [
        { id: "PAY101", amount: 500, currency: "USD", status: "SUCCESS" },
        { id: "PAY102", amount: 1200, currency: "INR", status: "FAILED" },
        { id: "PAY103", amount: 300, currency: "EUR", status: "SUCCESS" },
        { id: "PAY104", amount: 750, currency: "USD", status: "SUCCESS" },
        { id: "PAY105", amount: 150, currency: "USD", status: "FAILED" },
        { id: "PAY106", amount: 2200, currency: "INR", status: "SUCCESS" },
        { id: "PAY107", amount: 430, currency: "EUR", status: "FAILED" },
        { id: "PAY108", amount: 990, currency: "USD", status: "SUCCESS" },
        { id: "PAY109", amount: 600, currency: "USD", status: "SUCCESS" },
        { id: "PAY110", amount: 850, currency: "INR", status: "FAILED" },
        { id: "PAY111", amount: 410, currency: "USD", status: "SUCCESS" },
        { id: "PAY112", amount: 730, currency: "EUR", status: "SUCCESS" },
      ].map((tx) => ({
        ...tx,
        createdAt: new Date(),
      }));

      setTransactions(sampleTransactions);
    }, 800);
  }, []);

  if (!transactions) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
          <div className="animate-pulse text-gray-400">
            Loading summary...
          </div>
        </div>
      </>
    );
  }

  // 🔥 Auto calculated summary
  const total = transactions.length;
  const success = transactions.filter((t) => t.status === "SUCCESS").length;
  const failed = transactions.filter((t) => t.status === "FAILED").length;

  const pieData = [
    { name: "Success", value: success },
    { name: "Failed", value: failed },
  ];

  const COLORS = ["#22c55e", "#ef4444"];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-950 text-white p-10 space-y-12">
        <h2 className="text-3xl font-bold">Transaction Summary</h2>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Stats */}
          <div className="space-y-6">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
              <h3>Total Payments</h3>
              <p className="text-3xl font-bold mt-2">{total}</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
              <h3 className="text-green-400">Successful</h3>
              <p className="text-3xl font-bold mt-2">{success}</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
              <h3 className="text-red-400">Failed</h3>
              <p className="text-3xl font-bold mt-2">{failed}</p>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  outerRadius={120}
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction History */}
        <PaymentTable transactions={transactions} />
      </div>
    </>
  );
}