const BASE_URL = "http://localhost:5000";

const getToken = () => localStorage.getItem("token");

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// USER APIs

export const loginUser = async (data) => {
  const res = await fetch(`${BASE_URL}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const registerUser = async (data) => {
  const res = await fetch(`${BASE_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const getProfile = async () => {
  const res = await fetch(`${BASE_URL}/users/me`, {
    headers: authHeaders(),
  });
  return res.json();
};

// PAYMENT APIs

export const createPayment = async (data) => {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const processPayment = async (id) => {
  const res = await fetch(`${BASE_URL}/payments/${id}/process`, {
    method: "POST",
    headers: authHeaders(),
  });
  return res.json();
};

export const getPayment = async (id) => {
  const res = await fetch(`${BASE_URL}/payments/${id}`, {
    headers: authHeaders(),
  });
  return res.json();
};

export const getSummary = async () => {
  const res = await fetch(`${BASE_URL}/payments/summary`, {
    headers: authHeaders(),
  });
  return res.json();
};