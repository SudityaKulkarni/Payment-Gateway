import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

const STATUS_MAP = {
  CREATED: { color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  PROCESSING: { color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  SUCCESS: { color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
  FAILED: { color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  REFUNDED: { color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
};

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD"];

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { color: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-500" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} mr-1.5`}></span>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("payments");

  // Create form state
  const [form, setForm] = useState({
    amount: "", currency: "USD", payment_reference: "",
    description: "", customer_email: "", webhook_url: "",
  });
  const [creating, setCreating] = useState(false);

  // Status check
  const [checkId, setCheckId] = useState("");
  const [checkedPayment, setCheckedPayment] = useState(null);
  const [checking, setChecking] = useState(false);

  // Action loading states
  const [actionLoading, setActionLoading] = useState({});

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const handleUnauth = () => {
    localStorage.removeItem("token");
    navigate("/signin");
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/payments/`, { headers: authHeaders() });
      if (res.status === 401) return handleUnauth();
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      showToast("Failed to load payments", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API}/payments/summary`, { headers: authHeaders() });
      if (res.status === 401) return handleUnauth();
      const data = await res.json();
      setSummary(data);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    if (!token) { navigate("/signin"); return; }
    fetchPayments();
    fetchSummary();
  }, [token, fetchPayments, fetchSummary, navigate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const body = {
        amount: parseFloat(form.amount),
        currency: form.currency,
        payment_reference: form.payment_reference,
        description: form.description || undefined,
        customer_email: form.customer_email || undefined,
        webhook_url: form.webhook_url || undefined,
      };
      const res = await fetch(`${API}/payments/`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Failed to create payment", "error");
      } else {
        showToast(`Payment ${data.payment_reference} created!`);
        setForm({ amount: "", currency: "USD", payment_reference: "", description: "", customer_email: "", webhook_url: "" });
        fetchPayments(); fetchSummary();
        setActiveTab("payments");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setCreating(false);
    }
  };

  const doAction = async (id, action, label) => {
    setActionLoading(prev => ({ ...prev, [`${id}-${action}`]: true }));
    try {
      const res = await fetch(`${API}/payments/${id}/${action}`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || `${label} failed`, "error");
      } else {
        showToast(`${label} successful!`);
        fetchPayments(); fetchSummary();
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [`${id}-${action}`]: false }));
    }
  };

  const checkStatus = async (idToSearch = null) => {
    const id = (typeof idToSearch === "string" ? idToSearch : checkId).trim();
    if (!id) return;

    setChecking(true);
    setCheckedPayment(null);
    try {
      const res = await fetch(`${API}/payments/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Payment not found", "error");
      } else {
        setCheckedPayment(data);
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setChecking(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/signin");
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-xl transform transition-all duration-300 animate-bounce ${toast.type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"
          }`}>
          {toast.message}
        </div>
      )}

      {/* Modern Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
              <div className="bg-indigo-600 p-1.5 rounded-lg shadow-indigo-200 shadow-lg">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                PayGateway
              </span>
            </div>

            <nav className="hidden md:flex space-x-1">
              {[
                { id: "payments", label: "Payments", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
                { id: "create", label: "Create", icon: "M12 4v16m8-8H4" },
                { id: "check", label: "Lookup", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
                { id: "summary", label: "Summary", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === tab.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <button
                onClick={logout}
                className="text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Dashboard Header ────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === "payments" && "Transaction History"}
            {activeTab === "create" && "New Transaction"}
            {activeTab === "check" && "Payment Lookup"}
            {activeTab === "summary" && "Analytics Overview"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and simulate payment flows in real-time.
          </p>
        </div>

        {/* ── Payments List Tab ────────────────────────────────────────── */}
        {activeTab === "payments" && (
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">All Payments</h2>
              <button onClick={fetchPayments} className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold">
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-20 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : payments.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="mx-auto h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No payments found</h3>
                  <p className="text-gray-500 mt-1">Get started by creating your first simulated payment.</p>
                  <button
                    onClick={() => setActiveTab("create")}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Create Payment
                  </button>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID / Reference</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{p.payment_reference}</div>
                          <div className="text-xs text-gray-400 font-mono tracking-tighter truncate w-32">{p.id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount, p.currency)}</div>
                          <div className="text-xs text-gray-500 uppercase">{p.currency}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={p.status} />
                          {p.failure_reason && (
                            <div className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={p.failure_reason}>
                              {p.failure_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {p.status === "CREATED" && (
                              <button
                                onClick={() => doAction(p.id, "process", "Processing")}
                                className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded-md"
                                disabled={actionLoading[`${p.id}-process`]}
                              >
                                {actionLoading[`${p.id}-process`] ? "..." : "Process"}
                              </button>
                            )}
                            {p.status === "FAILED" && (
                              <button
                                onClick={() => doAction(p.id, "retry", "Retrying")}
                                className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 px-3 py-1 rounded-md"
                                disabled={actionLoading[`${p.id}-retry`]}
                              >
                                {actionLoading[`${p.id}-retry`] ? "..." : "Retry"}
                              </button>
                            )}
                            {p.status === "SUCCESS" && (
                              <button
                                onClick={() => doAction(p.id, "refund", "Refunding")}
                                className="text-purple-600 hover:text-purple-900 bg-purple-50 px-3 py-1 rounded-md"
                                disabled={actionLoading[`${p.id}-refund`]}
                              >
                                {actionLoading[`${p.id}-refund`] ? "..." : "Refund"}
                              </button>
                            )}
                            <button
                              onClick={() => { setCheckId(p.id); setActiveTab("check"); checkStatus(p.id); }}
                              className="text-gray-600 hover:text-gray-900 bg-gray-50 px-3 py-1 rounded-md"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Create Tab ────────────────────────────────────────── */}
        {activeTab === "create" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white shadow-xl border border-gray-200 rounded-2xl p-8">
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">$</div>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        placeholder="0.00"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Currency</label>
                    <select
                      className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    >
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Reference ID</label>
                  <input
                    type="text"
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="INV-2024-001"
                    value={form.payment_reference}
                    onChange={(e) => setForm({ ...form, payment_reference: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Email</label>
                    <input
                      type="email"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="client@example.com"
                      value={form.customer_email}
                      onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Webhook URL (Optional)</label>
                    <input
                      type="url"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="https://hooks.example.com/pay"
                      value={form.webhook_url}
                      onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="Payment for services rendered..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                <div className="bg-amber-50 rounded-lg p-4 flex gap-3">
                  <svg className="h-5 w-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-amber-700 leading-normal">
                    <strong>Rule simulation active:</strong> Amounts exceeding 10,000 will be flagged as fraudulent and fail automatically.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Register Initial Transaction"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Lookup Tab ────────────────────────────────────────── */}
        {activeTab === "check" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-6 shadow-sm border border-gray-200 rounded-xl flex gap-3">
              <input
                type="text"
                className="flex-1 block w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
                placeholder="Paste Payment ID or Reference (e.g. INV-2024-001)"
                value={checkId}
                onChange={(e) => setCheckId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkStatus()}
              />
              <button
                onClick={checkStatus}
                disabled={checking}
                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-bold rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all"
              >
                {checking ? "Searching..." : "Lookup"}
              </button>
            </div>

            {checkedPayment && (
              <div className="bg-white shadow-xl border border-gray-200 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100 flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Transaction Reference</span>
                    <h2 className="text-2xl font-black text-gray-900">{checkedPayment.payment_reference}</h2>
                    <p className="text-xs text-gray-500 font-mono mt-1">{checkedPayment.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={checkedPayment.status} />
                    <span className="text-2xl font-black text-indigo-600">
                      {formatCurrency(checkedPayment.amount, checkedPayment.currency)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100 italic">
                  {[
                    { label: "Created At", value: new Date(checkedPayment.created_at).toLocaleString() },
                    { label: "Last Updated", value: new Date(checkedPayment.updated_at).toLocaleString() },
                    { label: "Customer", value: checkedPayment.customer_email || "Not Provided" },
                    { label: "Retry Count", value: checkedPayment.retry_count },
                    { label: "Fraud Flag", value: checkedPayment.fraud_flag ? "🚨 FLAG TRIGGERED" : "Clear" },
                    { label: "Processing Start", value: checkedPayment.processing_started_at ? new Date(checkedPayment.processing_started_at).toLocaleString() : "Not Started" },
                  ].map((field, idx) => (
                    <div key={idx} className="bg-white p-6 not-italic">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{field.label}</p>
                      <p className="text-sm font-semibold text-gray-800">{field.value}</p>
                    </div>
                  ))}
                </div>

                <div className="p-8">
                  <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider border-b border-gray-100 pb-2">Audit Trail / Events</h3>
                  <div className="space-y-4">
                    {checkedPayment.events?.map((ev, i) => (
                      <div key={ev.id || i} className="flex items-center text-sm">
                        <div className="relative flex items-center h-full mr-4">
                          <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-indigo-500" : "bg-gray-300"}`}></div>
                          {i !== checkedPayment.events.length - 1 && <div className="absolute top-2 left-1 -ml-px h-10 w-0.5 bg-gray-100"></div>}
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 flex-1 flex flex-wrap gap-2 items-center">
                          <StatusBadge status={ev.from_status} />
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                          <StatusBadge status={ev.to_status} />
                          <span className="text-gray-500 italic ml-auto text-xs">{new Date(ev.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Summary Tab ────────────────────────────────────────── */}
        {activeTab === "summary" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: "Total Volume", value: summary?.total || 0, icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "text-indigo-600", bg: "bg-indigo-100" },
                { label: "Success Rate", value: summary?.total ? `${Math.round((summary.success / summary.total) * 100)}%` : "0%", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-emerald-600", bg: "bg-emerald-100" },
                { label: "Failed Transfers", value: summary?.failed || 0, icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-rose-600", bg: "bg-rose-100" },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center">
                  <div className={`p-4 rounded-xl ${stat.bg} ${stat.color} mr-5`}>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500">{stat.label}</p>
                    <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <span className="h-2 w-2 bg-indigo-600 rounded-full mr-2"></span>
                  Status Breakdown
                </h3>
                <div className="space-y-4">
                  {summary ? Object.entries({
                    Success: { val: summary.success, col: "bg-emerald-500" },
                    Failed: { val: summary.failed, col: "bg-rose-500" },
                    Refunded: { val: summary.refunded, col: "bg-purple-500" },
                    Processing: { val: summary.processing, col: "bg-amber-500" },
                  }).map(([label, { val, col }]) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold text-gray-700">{label}</span>
                        <span className="font-bold text-gray-900">{val}</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${col}`} style={{ width: `${(val / (summary.total || 1)) * 100}%` }}></div>
                      </div>
                    </div>
                  )) : "Loading data..."}
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <span className="h-2 w-2 bg-rose-600 rounded-full mr-2"></span>
                  Failure Analysis
                </h3>
                {summary && Object.keys(summary.failure_breakdown).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(summary.failure_breakdown).map(([reason, count]) => (
                      <div key={reason} className="p-4 bg-rose-50 rounded-xl border border-rose-100 flex justify-between items-center transition-all hover:bg-rose-100">
                        <span className="text-sm font-bold text-rose-800">{reason}</span>
                        <span className="bg-rose-200 text-rose-900 px-3 py-1 rounded-full text-xs font-black">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100">
                    <svg className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="font-bold">System performing optimally</p>
                    <p className="text-xs">No transaction failures recorded</p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 font-medium">
              Last updated: {summary ? new Date(summary.last_updated).toLocaleString() : "Never"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}