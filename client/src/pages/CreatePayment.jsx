import { useState } from "react";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

export default function CreatePayment() {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [customerId, setCustomerId] = useState("");
  const navigate = useNavigate();

  const handleCreate = (e) => {
    e.preventDefault();

    // TEMP fake ID (until backend connected)
    const fakeId = Math.floor(Math.random() * 100000);
    navigate(`/payment/${fakeId}`);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">
        <form
          onSubmit={handleCreate}
          className="bg-gray-900 p-10 rounded-xl w-96 space-y-4"
        >
          <h2 className="text-xl font-semibold">Create Payment</h2>

          <input
            type="number"
            placeholder="Amount"
            className="w-full p-3 rounded bg-gray-800"
            onChange={(e) => setAmount(e.target.value)}
          />

          <input
            type="text"
            placeholder="Currency"
            className="w-full p-3 rounded bg-gray-800"
            onChange={(e) => setCurrency(e.target.value)}
          />

          <input
            type="text"
            placeholder="Customer ID"
            className="w-full p-3 rounded bg-gray-800"
            onChange={(e) => setCustomerId(e.target.value)}
          />

          <button className="w-full bg-indigo-600 py-3 rounded">
            Create
          </button>
        </form>
      </div>
    </>
  );
}