import { useNavigate } from "react-router-dom";

export default function PaymentTable({ transactions }) {
  const navigate = useNavigate();

  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
      <h3 className="text-xl font-semibold mb-6">Transaction History</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="py-3">ID</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                onClick={() => navigate(`/payments/${tx.id}`)}
                className="border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer"
              >
                <td className="py-3">{tx.id}</td>
                <td>${tx.amount}</td>
                <td>{tx.currency}</td>

                <td>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      tx.status === "SUCCESS"
                        ? "bg-green-900 text-green-400"
                        : tx.status === "FAILED"
                        ? "bg-red-900 text-red-400"
                        : tx.status === "REFUNDED"
                        ? "bg-yellow-900 text-yellow-400"
                        : "bg-blue-900 text-blue-400"
                    }`}
                  >
                    {tx.status}
                  </span>
                </td>

                <td>
                  {new Date(tx.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}