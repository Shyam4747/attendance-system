import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as faceapi from "@vladmandic/face-api";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "./styles.css";

const API_URL = import.meta.env.VITE_ATTENDANCE_API_URL || "http://localhost:5050/api";
const CAMERA_TIMEOUT_MS = 10000;
const TOKEN_KEY = "attendance_admin_token";
const COMPANY_NAME = "ProJenius Innovation Technology Private Limited";
const ATTENDANCE_TIME_ZONE = "Asia/Kolkata";
const ATTENDANCE_TIME_LABEL = "IST - Tamil Nadu";

function getTodayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Format date time helper
function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ATTENDANCE_TIME_ZONE,
  });
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function loadImageDataUrl(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Could not load report logo."));
    image.src = src;
  });
}

function getCameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "Camera permission was denied. Allow camera access in the browser, refresh the page, and click Start Camera again.";
  }

  if (error?.name === "NotFoundError") {
    return "No camera was found on this device.";
  }

  if (error?.name === "NotReadableError") {
    return "The camera is already being used by another app. Close that app and try again.";
  }

  return error?.name ? `${error.name}: ${error.message}` : error.message;
}

function getApiErrorMessage(error) {
  const message = String(error?.message || error || "");

  if (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Load failed") ||
    message.includes("Network request failed")
  ) {
    return "Server is waking up. Please wait 30 seconds, then try again.";
  }

  return message || "Something went wrong. Please try again.";
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
}

function Icon({ name, size = 18, className = "" }) {
  const icons = {
    dashboard: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
    camera: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
    users: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    report: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    refresh: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
      </svg>
    ),
    logout: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
    plus: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    edit: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    check: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    alert: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    info: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    sun: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
    moon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
    search: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    filter: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
    ),
    download: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    close: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    fingerprint: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10A10 10 0 0 0 12 2z" />
        <path d="M12 6a6 6 0 0 0-6 6c0 2.21 1.79 4 4 4s4-1.79 4-4" />
        <path d="M12 9a3 3 0 0 0-3 3" />
      </svg>
    ),
    badge: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: size, height: size }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  };

  return icons[name] || null;
}

function StatCard({ label, value, detail, tone = "blue", icon }) {
  return (
    <article className={`glass-panel stat-card stat-card-${tone}`}>
      <div className="stat-card-header">
        <span>{label}</span>
        {icon && <div className="stat-card-icon"><Icon name={icon} size={18} /></div>}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [people, setPeople] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    personCode: "",
    name: "",
    role: "student",
    department: "",
    phone: "",
  });
  const [manualCode, setManualCode] = useState("");
  const [status, setStatusText] = useState("");
  const [faceNotice, setFaceNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceModelsReady, setFaceModelsReady] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceDetectionStatus, setFaceDetectionStatus] = useState("idle");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY) || "");
  const [admin, setAdmin] = useState(() => window.localStorage.getItem("attendance_admin_name") || "");
  const [loginForm, setLoginForm] = useState({ username: "admin", password: "" });
  const [loginError, setLoginError] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [reportFrom, setReportFrom] = useState(getTodayKey());
  const [reportTo, setReportTo] = useState(getTodayKey());
  const [reportDepartment, setReportDepartment] = useState("all");
  const [editingPersonId, setEditingPersonId] = useState("");
  
  // Custom Dynamic UI states
  const [theme, setTheme] = useState(() => window.localStorage.getItem("attendance_theme") || "dark");
  const [activeTab, setActiveTab] = useState("overview");
  const [toasts, setToasts] = useState([]);
  const [personPendingDelete, setPersonPendingDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Setup Theme on load / change
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light-theme");
    } else {
      root.classList.remove("light-theme");
    }
    window.localStorage.setItem("attendance_theme", theme);
  }, [theme]);

  // Toast adder
  const addToast = (title, message, type = "info") => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type, closing: false }]);

    // Trigger fade-out 300ms before removing
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, closing: true } : t))
      );
    }, 4700);

    // Delete toast completely
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Intercept old status banner with toast notification
  const setStatus = (message) => {
    setStatusText(message);
    if (!message) return;

    let title = "System Notification";
    let type = "info";

    if (message.toLowerCase().includes("camera")) {
      title = "Camera System";
    } else if (message.toLowerCase().includes("model") || message.toLowerCase().includes("face recognition")) {
      title = "Biometrics Engine";
    } else if (
      message.toLowerCase().includes("success") || 
      message.toLowerCase().includes("updated") || 
      message.toLowerCase().includes("added") || 
      message.toLowerCase().includes("marked") ||
      message.toLowerCase().includes("downloaded") ||
      message.toLowerCase().includes("exported")
    ) {
      title = "Success Action";
      type = "success";
    } else if (
      message.toLowerCase().includes("could not") || 
      message.toLowerCase().includes("fail") || 
      message.toLowerCase().includes("error") || 
      message.toLowerCase().includes("denied") ||
      message.toLowerCase().includes("timed out")
    ) {
      title = "System Alert";
      type = "error";
    }

    addToast(title, message, type);
  };

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const stats = useMemo(() => {
    const activePeople = people.filter((person) => person.active);
    const todayKey = new Date().toDateString();
    const todayRecords = records.filter((record) => new Date(record.markedAt).toDateString() === todayKey);
    const faceReady = people.filter((person) => person.faceProfile?.descriptor?.length).length;

    return {
      activePeople: activePeople.length,
      todayPresent: todayRecords.length,
      faceReady,
      fingerprintPending: people.filter((person) => person.fingerprintProfile?.status !== "registered").length,
    };
  }, [people, records]);

  const filteredPeople = useMemo(() => {
    const query = profileSearch.trim().toLowerCase();

    return people.filter((person) => {
      const matchesRole = roleFilter === "all" || person.role === roleFilter;
      const matchesSearch =
        !query ||
        [person.personCode, person.name, person.department, person.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      return matchesRole && matchesSearch;
    });
  }, [people, profileSearch, roleFilter]);

  const departments = useMemo(
    () =>
      Array.from(new Set(people.map((person) => person.department).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [people],
  );

  const reportStats = useMemo(() => {
    const present = records.filter((record) => record.status === "present").length;
    const face = records.filter((record) => record.method === "face").length;
    const manual = records.filter((record) => record.method === "manual").length;
    const uniquePeople = new Set(records.map((record) => record.personCode)).size;

    return { present, face, manual, uniquePeople };
  }, [records]);

  const faceReadiness = useMemo(() => {
    if (faceBusy) {
      return "Working on face recognition...";
    }

    if (!cameraActive) {
      return "Start the camera before registering or marking by face.";
    }

    if (!selectedPersonId) {
      return "Select a profile to register a face.";
    }

    return "Ready to register the selected profile or mark attendance by face.";
  }, [cameraActive, faceBusy, selectedPersonId]);

  function showStatus(message) {
    setStatus(message);
    setFaceNotice(message);
  }

  async function loadData() {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({ limit: "500" });

    if (reportFrom) {
      params.set("from", reportFrom);
    }

    if (reportTo) {
      params.set("to", reportTo);
    }

    if (reportDepartment !== "all") {
      params.set("department", reportDepartment);
    }

    const [peopleResponse, recordsResponse] = await Promise.all([
      fetch(`${API_URL}/people`, { headers: authHeaders }),
      fetch(`${API_URL}/attendance?${params.toString()}`, { headers: authHeaders }),
    ]);

    if (peopleResponse.status === 401 || recordsResponse.status === 401) {
      logout();
      return;
    }

    const peopleData = await peopleResponse.json();
    const recordsData = await recordsResponse.json();
    setPeople(peopleData.people || []);
    setRecords(recordsData.records || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData().catch((error) => {
      setStatus(getApiErrorMessage(error));
      setLoading(false);
    });
  }, [token, reportFrom, reportTo, reportDepartment]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!cameraActive || !faceModelsReady || !videoRef.current) {
      setFaceDetectionStatus("idle");
      return undefined;
    }

    let cancelled = false;
    let checking = false;

    const interval = window.setInterval(async () => {
      if (checking || faceBusy || !videoRef.current) {
        return;
      }

      checking = true;
      setFaceDetectionStatus("checking");

      try {
        const detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }),
        );

        if (!cancelled) {
          setFaceDetectionStatus(detection ? "detected" : "missing");
        }
      } catch (_error) {
        if (!cancelled) {
          setFaceDetectionStatus("missing");
        }
      } finally {
        checking = false;
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [cameraActive, faceModelsReady, faceBusy]);

  async function login(event) {
    event.preventDefault();
    setLoginError("");
    const formData = new FormData(event.currentTarget);
    const credentials = {
      username: String(formData.get("username") || "").trim(),
      password: String(formData.get("password") || ""),
    };

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      window.localStorage.setItem(TOKEN_KEY, data.token);
      window.localStorage.setItem("attendance_admin_name", data.admin.username);
      setToken(data.token);
      setAdmin(data.admin.username);
      setLoginForm({ username: data.admin.username, password: "" });
      setStatus("Admin login successful.");
    } catch (error) {
      setLoginError(getApiErrorMessage(error));
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem("attendance_admin_name");
    setToken("");
    setAdmin("");
    setPeople([]);
    setRecords([]);
    setStatusText("");
    stopCamera();
    addToast("Logged Out", "Admin session ended.", "info");
  }

  async function loadFaceModels() {
    if (faceModelsReady) {
      return;
    }

    showStatus("Loading face recognition models...");
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]);
    setFaceModelsReady(true);
    showStatus("Face recognition is ready.");
  }

  async function startCamera() {
    showStatus("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not available in this browser. Open this app in Chrome or Edge.");
      }

      await loadFaceModels();
      showStatus("Waiting for camera permission...");
      const cameraRequest = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });
      const timeout = new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error("Camera permission timed out. Click Allow if the browser shows a camera prompt."));
        }, CAMERA_TIMEOUT_MS);
      });
      const stream = await Promise.race([cameraRequest, timeout]);

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      showStatus("Camera started. Keep one face clearly visible.");
    } catch (error) {
      showStatus(`Could not start camera. ${getCameraErrorMessage(error)}`);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setFaceDetectionStatus("idle");
    showStatus("Camera stopped.");
  }

  async function detectCurrentFace() {
    if (!videoRef.current || !cameraActive) {
      throw new Error("Start the camera first.");
    }

    const detection = await faceapi
      .detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }),
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      throw new Error("No clear face detected. Face the camera and try again.");
    }

    return Array.from(detection.descriptor);
  }

  function captureImageDataUrl() {
    if (!videoRef.current) {
      return "";
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const context = canvas.getContext("2d");
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function registerFace() {
    if (!cameraActive) {
      showStatus("Start the camera first, then click Register Face.");
      return;
    }

    if (!selectedPersonId) {
      showStatus("Select a profile before registering a face.");
      return;
    }

    setFaceBusy(true);
    showStatus("Scanning face for registration. Keep your face centered...");

    try {
      const descriptor = await detectCurrentFace();
      const response = await fetch(`${API_URL}/people/${selectedPersonId}/face-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          descriptor,
          imageDataUrl: captureImageDataUrl(),
        }),
      });

      if (!response.ok) {
        throw new Error("Could not save face profile.");
      }

      showStatus("Face profile registered successfully.");
      await loadData();
    } catch (error) {
      showStatus(getApiErrorMessage(error));
    } finally {
      setFaceBusy(false);
    }
  }

  async function markFaceAttendance() {
    if (!cameraActive) {
      showStatus("Start the camera first, then click Mark by Face.");
      return;
    }

    setFaceBusy(true);
    showStatus("Matching face. Keep one registered face visible...");

    try {
      const descriptor = await detectCurrentFace();
      const response = await fetch(`${API_URL}/attendance/face`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ descriptor }),
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data.error || "No matching face profile found.");
      }

      showStatus(`Attendance marked for ${data.person.name}.`);
      await loadData();
    } catch (error) {
      showStatus(getApiErrorMessage(error));
    } finally {
      setFaceBusy(false);
    }
  }

  async function addPerson(event) {
    event.preventDefault();
    setStatusText("");

    try {
      const response = await fetch(editingPersonId ? `${API_URL}/people/${editingPersonId}` : `${API_URL}/people`, {
        method: editingPersonId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = await readJson(response);
        setStatus(data.error || `Could not ${editingPersonId ? "update" : "add"} profile. Check ID uniqueness.`);
        return;
      }

      setForm({ personCode: "", name: "", role: "student", department: "", phone: "" });
      setEditingPersonId("");
      setStatus(editingPersonId ? "Profile updated successfully." : "Profile added successfully.");
      await loadData();
    } catch (error) {
      setStatus(getApiErrorMessage(error));
    }
  }

  function startEditProfile(person) {
    setActiveTab("profiles");
    setEditingPersonId(person._id);
    setForm({
      personCode: person.personCode || "",
      name: person.name || "",
      role: person.role || "student",
      department: person.department || "",
      phone: person.phone || "",
    });
    setStatus(`Editing profile: ${person.name}`);
    setTimeout(() => {
      document.getElementById("profile-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function cancelEditProfile() {
    setEditingPersonId("");
    setForm({ personCode: "", name: "", role: "student", department: "", phone: "" });
    setStatus("Profile editing cancelled.");
  }

  function requestDeletePerson(person) {
    setPersonPendingDelete(person);
  }

  async function deletePerson() {
    if (!personPendingDelete) {
      return;
    }

    setDeleteBusy(true);
    try {
      const response = await fetch(`${API_URL}/people/${personPendingDelete._id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      const data = await readJson(response);

      if (!response.ok) {
        setStatus(data.error || "Could not remove profile.");
        return;
      }

      if (editingPersonId === personPendingDelete._id) {
        cancelEditProfile();
      }

      setStatus(`Removed ${personPendingDelete.name}. Deleted ${data.deletedAttendanceRecords || 0} attendance records.`);
      setPersonPendingDelete(null);
      await loadData();
    } catch (error) {
      setStatus(getApiErrorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function markManual(event) {
    event.preventDefault();
    setStatusText("");

    try {
      const response = await fetch(`${API_URL}/attendance/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ personCode: manualCode, status: "present" }),
      });

      if (!response.ok) {
        const data = await readJson(response);
        setStatus(data.error || "Could not mark attendance. Check the ID.");
        return;
      }

      setManualCode("");
      setStatus("Attendance marked as present.");
      await loadData();
    } catch (error) {
      setStatus(getApiErrorMessage(error));
    }
  }

  function exportCsv() {
    if (!records.length) {
      setStatus("No attendance records available for export.");
      return;
    }

    const rows = [
      ["ID", "Name", "Role", "Department", "Method", "Status", "Attendance Date", `Marked Time (${ATTENDANCE_TIME_LABEL})`],
      ...records.map((record) => [
        record.personCode,
        record.person?.name || "Unknown",
        record.person?.role || "",
        record.person?.department || "",
        record.method,
        record.status,
        record.attendanceDate || "",
        formatDateTime(record.markedAt),
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${reportFrom || "all"}-to-${reportTo || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("CSV report exported.");
  }

  async function exportPdf() {
    if (!records.length) {
      setStatus("No attendance records available for export.");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const fileName = `attendance-report-${reportFrom || "all"}-to-${reportTo || "all"}.pdf`;
    let logoDataUrl = "";

    try {
      logoDataUrl = await loadImageDataUrl("/brand/projenius-logo.png");
    } catch (_error) {
      logoDataUrl = "";
    }

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", 40, 30, 44, 44);
    }

    doc.setTextColor(8, 47, 131);
    doc.setFontSize(18);
    doc.text(COMPANY_NAME, logoDataUrl ? 96 : 40, 42);
    doc.setTextColor(19, 35, 58);
    doc.setFontSize(13);
    doc.text("Attendance Report", logoDataUrl ? 96 : 40, 64);
    doc.setTextColor(89, 104, 125);
    doc.setFontSize(10);
    doc.text(`Period: ${reportFrom || "All"} to ${reportTo || "All"}`, 40, 92);
    doc.text(`Department: ${reportDepartment === "all" ? "All departments" : reportDepartment}`, 40, 108);
    doc.text(`Time zone: ${ATTENDANCE_TIME_LABEL}`, 40, 124);
    doc.text(
      `Records: ${records.length} | People: ${reportStats.uniquePeople} | Face: ${reportStats.face} | Manual: ${reportStats.manual}`,
      40,
      140,
    );

    autoTable(doc, {
      startY: 162,
      head: [["ID", "Name", "Role", "Department", "Method", "Status", "Date", `Marked Time (${ATTENDANCE_TIME_LABEL})`]],
      body: records.map((record) => [
        record.personCode,
        record.person?.name || "Unknown",
        record.person?.role || "",
        record.person?.department || "",
        record.method,
        record.status,
        record.attendanceDate || "",
        formatDateTime(record.markedAt),
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 5,
      },
      headStyles: {
        fillColor: [8, 47, 131],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [247, 251, 255],
      },
    });

    doc.save(fileName);
    setStatus("PDF report downloaded.");
  }

  // Handle header "Mark Attendance" click to switch tab and scroll
  function handleMarkAttendanceClick(e) {
    e.preventDefault();
    setActiveTab("scanner");
    setTimeout(() => {
      document.getElementById("manual-attendance-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  if (!token) {
    return (
      <main className="login-shell">
        {/* Toast Container for login context */}
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type} ${t.closing ? "toast-closing" : ""}`}>
              <div className="toast-icon">
                {t.type === "success" && <Icon name="check" size={18} />}
                {t.type === "error" && <Icon name="alert" size={18} />}
                {t.type === "info" && <Icon name="info" size={18} />}
              </div>
              <div className="toast-content">
                <h4>{t.title}</h4>
                <p>{t.message}</p>
              </div>
              <button type="button" className="toast-close" onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>

        <section className="glass-panel login-panel">
          <div className="brand-lockup login-brand">
            <img src="/brand/projenius-logo.png" alt="ProJenius logo" />
            <div>
              <span>{COMPANY_NAME}</span>
              <small>Admin Access</small>
            </div>
          </div>
          <h1>Attendance System</h1>
          <p>Sign in to manage profiles, biometric registration, and attendance records.</p>

          <form className="login-form" onSubmit={login}>
            <label>
              Username
              <input name="username" value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} required />
            </label>
            <label>
              Password
              <input name="password" type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Enter password" required />
            </label>
            {loginError && <div className="login-error"><Icon name="alert" size={16} />{loginError}</div>}
            <button type="submit" className="primary-button">
              <Icon name="badge" size={18} />
              Login
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {/* Interactive Toast Notifications Stack */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type} ${t.closing ? "toast-closing" : ""}`}>
            <div className="toast-icon">
              {t.type === "success" && <Icon name="check" size={18} />}
              {t.type === "error" && <Icon name="alert" size={18} />}
              {t.type === "info" && <Icon name="info" size={18} />}
            </div>
            <div className="toast-content">
              <h4>{t.title}</h4>
              <p>{t.message}</p>
            </div>
            <button type="button" className="toast-close" onClick={() => {
              setToasts((prev) => prev.map((item) => item.id === t.id ? { ...item, closing: true } : item));
              setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== t.id)), 300);
            }}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>

      {personPendingDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !deleteBusy && setPersonPendingDelete(null)}>
          <section className="glass-panel confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-profile-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="confirm-icon">
              <Icon name="alert" size={22} />
            </div>
            <div className="confirm-copy">
              <span className="section-kicker">Remove Profile</span>
              <h2 id="delete-profile-title">{personPendingDelete.name}</h2>
              <p>
                This will permanently remove {personPendingDelete.personCode} and delete their attendance records from reports.
              </p>
            </div>
            <div className="confirm-actions">
              <button type="button" className="secondary-button" onClick={() => setPersonPendingDelete(null)} disabled={deleteBusy}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={deletePerson} disabled={deleteBusy}>
                <Icon name="close" size={16} />
                {deleteBusy ? "Removing..." : "Remove"}
              </button>
            </div>
          </section>
        </div>
      )}

      <header className="glass-panel hero">
        <div className="hero-copy">
          <div className="brand-lockup hero-brand">
            <img src="/brand/projenius-logo.png" alt="ProJenius logo" />
            <div>
              <span>{COMPANY_NAME}</span>
              <small>Admin biometric console</small>
            </div>
          </div>
          <span className="eyebrow">Biometric Attendance Console</span>
          <h1>Attendance System</h1>
          <p>Manage profiles, mark attendance, and prepare face and fingerprint workflows from one dashboard.</p>
        </div>
        <div className="hero-actions">
          <span className="admin-chip">
            <Icon name="users" size={14} />
            Admin: {admin}
          </span>
          <button 
            type="button" 
            className="theme-toggle" 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
          </button>
          <button type="button" className="secondary-button" onClick={() => { loadData(); addToast("Reloading Data", "Fetching fresh profiles and logs.", "info"); }}>
            <Icon name="refresh" size={16} />
            Refresh
          </button>
          <button type="button" className="secondary-button" onClick={logout}>
            <Icon name="logout" size={16} />
            Logout
          </button>
          <a className="cyan-button" href="#manual-attendance" onClick={handleMarkAttendanceClick}>
            <Icon name="camera" size={16} />
            Biometric Scanner
          </a>
        </div>
      </header>

      {/* Tab Navigation System */}
      <div className="tab-navigation">
        <button 
          type="button" 
          className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <Icon name="dashboard" />
          Overview
        </button>
        <button 
          type="button" 
          className={`tab-button ${activeTab === "scanner" ? "active" : ""}`}
          onClick={() => setActiveTab("scanner")}
        >
          <Icon name="camera" />
          Face Scanner
        </button>
        <button 
          type="button" 
          className={`tab-button ${activeTab === "profiles" ? "active" : ""}`}
          onClick={() => setActiveTab("profiles")}
        >
          <Icon name="users" />
          Profiles
        </button>
        <button 
          type="button" 
          className={`tab-button ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <Icon name="report" />
          Reports
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="tab-content">
          <section className="stats-grid" aria-label="Attendance summary">
            <StatCard label="Active profiles" value={stats.activePeople} detail="Students and employees" tone="blue" icon="users" />
            <StatCard label="Today present" value={stats.todayPresent} detail="Marked today" tone="green" icon="check" />
            <StatCard label="Face profiles" value={stats.faceReady} detail="Ready for matching" tone="cyan" icon="camera" />
            <StatCard label="Fingerprint pending" value={stats.fingerprintPending} detail="Scanner not selected" tone="amber" icon="fingerprint" />
          </section>

          <div className="work-grid">
            {/* Filtered logs in Overview for instant feedback */}
            <section className="glass-panel panel table-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Logs</span>
                  <h2>Recent Logins</h2>
                </div>
                <span className="pill">{records.slice(0, 10).length} recent</span>
              </div>

              <div className="table attendance-table">
                <div className="table-row table-head">
                  <span>ID</span>
                  <span>Name</span>
                  <span>Method</span>
                  <span>Time ({ATTENDANCE_TIME_LABEL})</span>
                  <span>Status</span>
                </div>
                {records.length === 0 && (
                  <div className="empty-state">
                    <Icon name="info" />
                    No attendance records logged today.
                  </div>
                )}
                {records.slice(0, 10).map((record) => (
                  <div className="table-row" key={record._id}>
                    <span>{record.personCode}</span>
                    <strong>{record.person?.name || "Unknown"}</strong>
                    <span className="capitalize">{record.method}</span>
                    <span>{formatDateTime(record.markedAt)}</span>
                    <span className="status-chip present">{record.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-panel panel action-panel" id="manual-attendance-section">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Attendance</span>
                  <h2>Manual Entry</h2>
                </div>
                <span className="live-dot">Ready</span>
              </div>

              <form className="manual-form" onSubmit={markManual}>
                <label>
                  ID / Roll number
                  <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Enter ID to mark present" required />
                </label>
                <button type="submit" className="primary-button">
                  <Icon name="check" size={16} />
                  Mark Present
                </button>
              </form>

              <div className="biometric-stack">
                <div className="biometric-tile biometric-face">
                  <span>Face Recognition</span>
                  <strong>
                    <Icon name="camera" size={16} />
                    {faceModelsReady ? "Models ready" : "Laptop camera"}
                  </strong>
                  <small>Register a profile face, then mark attendance from the same camera.</small>
                </div>
                <div className="biometric-tile biometric-fingerprint">
                  <span>Fingerprint Scanner</span>
                  <strong>
                    <Icon name="fingerprint" size={16} />
                    Adapter pending
                  </strong>
                  <small>Hardware SDK will plug in after the scanner is selected.</small>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === "scanner" && (
        <div className="tab-content">
          <section className="glass-panel panel camera-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Biometric Capture</span>
                <h2>Laptop Camera</h2>
              </div>
              <span className={`live-dot ${cameraActive ? "active" : ""}`} style={{ background: cameraActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: cameraActive ? "var(--color-green)" : "var(--color-danger)" }}>
                {cameraActive ? "Camera active" : "Camera off"}
              </span>
            </div>

            <div className="camera-layout">
              <div className="video-frame">
                <video ref={videoRef} muted playsInline />
                {!cameraActive && (
                  <div className="video-placeholder">
                    <Icon name="camera" size={48} />
                    <span>Camera preview is offline</span>
                  </div>
                )}
                {cameraActive && (
                  <>
                    {/* Glowing Laser Scan Bar */}
                    <div className="scan-line"></div>
                    
                    {/* Target Brackets Reticles */}
                    <div className={`scanner-target ${faceDetectionStatus}`}>
                      <div className="scanner-target-corner-br"></div>
                    </div>

                    {/* Status Badge Overlays */}
                    <div className={`face-indicator face-indicator-${faceDetectionStatus}`}>
                      {faceDetectionStatus === "detected"
                        ? "Face Detected"
                        : faceDetectionStatus === "checking"
                          ? "Analyzing Frame..."
                          : "Scanning..."}
                    </div>
                  </>
                )}
              </div>

              <div className="camera-controls">
                <label>
                  Profile for registration
                  <select value={selectedPersonId} onChange={(event) => setSelectedPersonId(event.target.value)}>
                    <option value="">Select profile</option>
                    {people.map((person) => (
                      <option value={person._id} key={person._id}>
                        {person.personCode} - {person.name} ({person.faceProfile?.descriptor?.length ? "Registered" : "Not Registered"})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="button-row">
                  <div className="camera-panel-actions">
                    {!cameraActive ? (
                      <button type="button" className="primary-button" onClick={startCamera} disabled={faceBusy}>
                        <Icon name="camera" size={16} />
                        Start Camera
                      </button>
                    ) : (
                      <button type="button" className="danger-button" onClick={stopCamera} disabled={faceBusy}>
                        <Icon name="close" size={16} />
                        Stop Camera
                      </button>
                    )}
                  </div>
                  <button type="button" className="primary-button" onClick={registerFace} disabled={faceBusy || !cameraActive || !selectedPersonId}>
                    <Icon name="user" size={16} />
                    {faceBusy ? <span className="spinner"></span> : "Register Face"}
                  </button>
                  <button type="button" className="cyan-button" onClick={markFaceAttendance} disabled={faceBusy || !cameraActive}>
                    <Icon name="check" size={16} />
                    {faceBusy ? <span className="spinner"></span> : "Mark by Face"}
                  </button>
                </div>

                <div className="readiness-note">
                  {faceNotice || faceReadiness}
                </div>

                <p className="camera-note">
                  Ensure the person is front-facing and well lit. StandardTinyFaceDetector runs in real-time on your processor.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "profiles" && (
        <div className="tab-content">
          <div className="work-grid">
            <form className="glass-panel panel form-panel" id="profile-form" onSubmit={addPerson}>
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Registration</span>
                  <h2>{editingPersonId ? "Edit Profile" : "Add Profile"}</h2>
                </div>
                <span className="pill">{editingPersonId ? "Modifying existing profile" : "Create new"}</span>
              </div>

              <div className="input-grid">
                <label>
                  ID / Roll number
                  <input value={form.personCode} onChange={(event) => setForm({ ...form, personCode: event.target.value })} placeholder="PJ-001" required />
                </label>
                <label>
                  Full name
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Student or employee name" required />
                </label>
                <label>
                  Role
                  <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                    <option value="student">Student</option>
                    <option value="employee">Employee</option>
                  </select>
                </label>
                <label>
                  Department
                  <input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="AI, IoT, HR..." />
                </label>
                <label className="span-2">
                  Phone
                  <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Optional contact number" />
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="primary-button">
                  <Icon name="plus" size={16} />
                  {editingPersonId ? "Save Changes" : "Create Profile"}
                </button>
                {editingPersonId && (
                  <button type="button" className="secondary-action" onClick={cancelEditProfile}>
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <section className="glass-panel panel data-panel table-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Directory</span>
                  <h2>Profiles</h2>
                </div>
                <span className="pill">{people.length} total</span>
              </div>

              <div className="table-tools">
                <div style={{ position: "relative" }}>
                  <input value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} placeholder="Search ID, name, department..." style={{ paddingLeft: "38px" }} />
                  <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", opacity: 0.5, pointerEvents: "none" }}>
                    <Icon name="search" size={16} />
                  </div>
                </div>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="all">All roles</option>
                  <option value="student">Students</option>
                  <option value="employee">Employees</option>
                </select>
              </div>

              <div className="table profile-table">
                <div className="table-row table-head">
                  <span>ID</span>
                  <span>Name</span>
                  <span>Role</span>
                  <span>Biometric</span>
                  <span>Actions</span>
                </div>
                {people.length === 0 && (
                  <div className="empty-state">
                    <Icon name="info" />
                    No profiles registered yet.
                  </div>
                )}
                {people.length > 0 && filteredPeople.length === 0 && (
                  <div className="empty-state">
                    <Icon name="search" />
                    No profiles match the filter.
                  </div>
                )}
                {filteredPeople.map((person) => (
                  <div className="table-row" key={person._id}>
                    <span>{person.personCode}</span>
                    <strong>{person.name}</strong>
                    <span className="capitalize">{person.role}</span>
                    <span className={`status-chip ${person.faceProfile?.descriptor?.length ? "registered" : "not-registered"}`}>
                      {person.faceProfile?.descriptor?.length ? "registered" : "not registered"}
                    </span>
                    <span className="row-actions">
                      <button type="button" className="inline-action" onClick={() => startEditProfile(person)}>
                        <Icon name="edit" size={12} />
                        Edit
                      </button>
                      <button type="button" className="inline-action inline-action-danger" onClick={() => requestDeletePerson(person)}>
                        <Icon name="close" size={12} />
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="tab-content">
          <section className="glass-panel panel report-panel table-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Reports</span>
                <h2>Attendance Analytics</h2>
              </div>
              <div className="export-actions">
                <button type="button" className="secondary-button" onClick={exportCsv}>
                  <Icon name="download" size={14} />
                  Export CSV
                </button>
                <button type="button" className="primary-button" onClick={exportPdf}>
                  <Icon name="download" size={14} />
                  Export PDF
                </button>
              </div>
            </div>

            <div className="report-tools">
              <label>
                From
                <input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} />
              </label>
              <label>
                To
                <input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} />
              </label>
              <label>
                Department
                <select value={reportDepartment} onChange={(event) => setReportDepartment(event.target.value)}>
                  <option value="all">All departments</option>
                  {departments.map((department) => (
                    <option value={department} key={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="timezone-note">All reports, dates, and timestamp columns are localized to {ATTENDANCE_TIME_LABEL}.</p>

            <div className="report-summary">
              <div className="report-summary-card">
                <span>Total Records</span>
                <strong>{records.length}</strong>
              </div>
              <div className="report-summary-card">
                <span>Unique Checked-In</span>
                <strong>{reportStats.uniquePeople}</strong>
              </div>
              <div className="report-summary-card">
                <span>Face Matched</span>
                <strong>{reportStats.face}</strong>
              </div>
              <div className="report-summary-card">
                <span>Manual Entry</span>
                <strong>{reportStats.manual}</strong>
              </div>
            </div>

            <div className="panel-heading" style={{ marginTop: "10px", marginBottom: "15px" }}>
              <div>
                <span className="section-kicker">Data Logs</span>
                <h2>Filtered Attendance Logs</h2>
              </div>
              <span className="pill">{loading ? "Loading..." : `${records.length} shown`}</span>
            </div>

            <div className="table attendance-table">
              <div className="table-row table-head">
                <span>ID</span>
                <span>Name</span>
                <span>Method</span>
                <span>Time ({ATTENDANCE_TIME_LABEL})</span>
                <span>Status</span>
              </div>
              {records.length === 0 && (
                <div className="empty-state">
                  <Icon name="info" />
                  No logs match the selected filter query.
                </div>
              )}
              {records.map((record) => (
                <div className="table-row" key={record._id}>
                  <span>{record.personCode}</span>
                  <strong>{record.person?.name || "Unknown"}</strong>
                  <span className="capitalize">{record.method}</span>
                  <span>{formatDateTime(record.markedAt)}</span>
                  <span className="status-chip present">{record.status}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
