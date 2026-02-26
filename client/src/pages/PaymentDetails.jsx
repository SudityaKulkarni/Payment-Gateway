import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import StatusBadge from "../components/StatusBadge";
import { useState, useEffect } from "react";

export default function PaymentDetails() {
  const { id } = useParams();
  const [status, setStatus] = useState("PROCESSING");

  useEffect(() => {
    setTimeout(() => {
      const random = Math.random() > 0.5 ? "SUCCESS" : "FAILED";
      setStatus(random);
    }, 3000);
  }, []);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center">
        <h2 className="text-2xl mb-4">Payment ID: {id}</h2>
        <StatusBadge status={status} />
      </div>
    </>
  );
}