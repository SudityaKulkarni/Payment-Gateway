export default function StatusBadge({ status }) {
  const base = "px-3 py-1 rounded-full text-sm font-medium";

  if (status === "SUCCESS")
    return <span className={`${base} bg-green-500/20 text-green-400`}>SUCCESS</span>;

  if (status === "FAILED")
    return <span className={`${base} bg-red-500/20 text-red-400`}>FAILED</span>;

  if (status === "PROCESSING")
    return <span className={`${base} bg-yellow-500/20 text-yellow-400`}>PROCESSING</span>;

  return <span className={`${base} bg-gray-500/20 text-gray-300`}>CREATED</span>;
}