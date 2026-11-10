
import { useCallback, useEffect, useState } from "react";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "./firebase";

import {
  createStaffAccount,
  getStaffAccounts,
  setStaffStatus,
  lockAllStaffAccounts,
  type StaffAccount,
} from "./staffService";

interface ActivityLog {
  id: string;
  userName: string;
  role: string;
  action: string;
  module: string;
  createdAt: number;
}

const moneyDate = (timestamp: number) => {
  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [staffData, logSnapshot] = await Promise.all([
        getStaffAccounts(),
        getDocs(
          query(
            collection(db, "activityLogs"),
            orderBy("createdAt", "desc"),
            limit(50)
          )
        ),
      ]);

      setStaff(staffData);

      setLogs(
        logSnapshot.docs.map((entry) => {
          const data = entry.data();

          return {
            id: entry.id,
            userName: String(data.userName ?? ""),
            role: String(data.role ?? ""),
            action: String(data.action ?? ""),
            module: String(data.module ?? ""),
            createdAt: Number(data.createdAt ?? 0),
          };
        })
      );
    } catch (err) {
      console.error("Staff Management load error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Staff Data लोड नहीं हो सका।"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateStaff = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");

    try {
      setSaving(true);

      await createStaffAccount({
        name,
        username,
        password,
      });

      setName("");
      setUsername("");
      setPassword("");

      setMessage("नया Staff Account सफलतापूर्वक बन गया।");

      await loadData();
    } catch (err) {
      console.error("Create Staff error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Staff Account नहीं बन पाया।"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    staffUid: string,
    currentStatus: "active" | "inactive"
  ) => {
    const newStatus =
      currentStatus === "active" ? "inactive" : "active";

    const confirmed = window.confirm(
      newStatus === "inactive"
        ? "क्या आप इस Staff का Access बंद करना चाहते हैं?"
        : "क्या आप इस Staff को दोबारा Active करना चाहते हैं?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await setStaffStatus(staffUid, newStatus);

      setMessage(
        newStatus === "inactive"
          ? "Staff Account Inactive कर दिया गया।"
          : "Staff Account Active कर दिया गया।"
      );

      await loadData();
    } catch (err) {
      console.error("Staff Status error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Staff Status अपडेट नहीं हुआ।"
      );
    }
  };

  const handleEmergencyLock = async () => {
    const activeCount = staff.filter(
      (entry) => entry.status === "active"
    ).length;

    if (activeCount === 0) {
      setMessage("कोई Active Staff Account नहीं है।");
      return;
    }

    const confirmed = window.confirm(
      `चेतावनी!\n\n${activeCount} Active Staff Accounts बंद हो जाएंगे।\n\nक्या आप Emergency Lock करना चाहते हैं?`
    );

    if (!confirmed) return;

    setLocking(true);
    setError("");
    setMessage("");

    try {
      const count = await lockAllStaffAccounts();

      setMessage(
        `${count} Staff Accounts सफलतापूर्वक Inactive कर दिए गए।`
      );

      await loadData();
    } catch (err) {
      console.error("Emergency Lock error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Emergency Lock पूरा नहीं हो सका।"
      );

      await loadData();
    } finally {
      setLocking(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>👨‍💼 Staff Management</h2>

      <p style={styles.subtitle}>
        Staff Accounts और Access Control
      </p>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {message && (
        <div style={styles.success}>
          {message}
        </div>
      )}

      {/* Emergency Lock */}
      <section style={styles.emergencyCard}>
        <div>
          <h3 style={styles.emergencyTitle}>
            🔒 Emergency Staff Lock
          </h3>

          <p style={styles.emergencyText}>
            सभी Active Staff Accounts का Access एक साथ बंद करें।
            Owner Account पर इसका प्रभाव नहीं पड़ेगा।
          </p>
        </div>

        <button
          type="button"
          style={{
            ...styles.emergencyButton,
            opacity: locking ? 0.6 : 1,
          }}
          disabled={locking || loading}
          onClick={handleEmergencyLock}
        >
          {locking
            ? "Lock हो रहा है..."
            : "सभी Staff का Access बंद करें"}
        </button>
      </section>

      {/* Create Staff */}
      <section style={styles.card}>
        <h3 style={styles.sectionTitle}>
          नया Staff Account बनाएँ
        </h3>

        <form onSubmit={handleCreateStaff}>
          <label style={styles.label}>
            Staff का नाम
          </label>

          <input
            style={styles.input}
            type="text"
            placeholder="जैसे Rahul Kumar"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            required
            minLength={2}
          />

          <label style={styles.label}>
            Staff Login ID
          </label>

          <input
            style={styles.input}
            type="text"
            placeholder="जैसे RAHUL01"
            value={username}
            onChange={(event) =>
              setUsername(
                event.target.value.toUpperCase()
              )
            }
            required
            minLength={3}
            maxLength={20}
          />

          <label style={styles.label}>
            Login Password
          </label>

          <input
            style={styles.input}
            type="password"
            placeholder="कम से कम 6 अक्षर"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
            minLength={6}
            autoComplete="new-password"
          />

          <button
            type="submit"
            style={styles.primaryButton}
            disabled={saving}
          >
            {saving
              ? "Account बनाया जा रहा है..."
              : "+ Staff Account बनाएँ"}
          </button>
        </form>
      </section>

      {/* Staff List */}
      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>
            Staff Accounts ({staff.length})
          </h3>

          <button
            type="button"
            style={styles.refreshButton}
            onClick={() => void loadData()}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <p style={styles.empty}>
            Staff Data लोड हो रहा है...
          </p>
        ) : staff.length === 0 ? (
          <p style={styles.empty}>
            अभी कोई Staff Account नहीं है।
          </p>
        ) : (
          <div style={styles.list}>
            {staff.map((entry) => (
              <div
                key={entry.uid}
                style={styles.staffItem}
              >
                <div style={styles.staffInfo}>
                  <strong style={styles.staffName}>
                    {entry.name}
                  </strong>

                  <span style={styles.staffDetail}>
                    ID: {entry.username}
                  </span>

                  <span style={styles.staffDetail}>
                    {entry.email}
                  </span>

                  <span
                    style={{
                      ...styles.status,
                      background:
                        entry.status === "active"
                          ? "#e2f5e8"
                          : "#fde7e7",
                      color:
                        entry.status === "active"
                          ? "#20723b"
                          : "#a12626",
                    }}
                  >
                    {entry.status === "active"
                      ? "● Active"
                      : "● Inactive"}
                  </span>
                </div>

                <button
                  type="button"
                  style={{
                    ...styles.statusButton,
                    background:
                      entry.status === "active"
                        ? "#a52a2a"
                        : "#287a43",
                  }}
                  onClick={() =>
                    void handleStatusChange(
                      entry.uid,
                      entry.status
                    )
                  }
                >
                  {entry.status === "active"
                    ? "Lock"
                    : "Activate"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activity Log */}
      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>
            📋 Activity Log
          </h3>

          <span style={styles.logCount}>
            Latest 50
          </span>
        </div>

        {loading ? (
          <p style={styles.empty}>
            Activity Log लोड हो रहा है...
          </p>
        ) : logs.length === 0 ? (
          <p style={styles.empty}>
            अभी कोई Activity दर्ज नहीं है।
          </p>
        ) : (
          <div style={styles.logList}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={styles.logItem}
              >
                <div style={styles.logTop}>
                  <strong>{log.userName}</strong>

                  <span style={styles.logRole}>
                    {log.role}
                  </span>
                </div>

                <div style={styles.logAction}>
                  {log.action}
                </div>

                <div style={styles.logMeta}>
                  Module: {log.module}
                </div>

                <div style={styles.logDate}>
                  {moneyDate(log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    color: "#402b20",
    width: "100%",
    paddingBottom: 20,
  },
  heading: {
    fontSize: 23,
    margin: "5px 0",
  },
  subtitle: {
    color: "#806c58",
    fontSize: 13,
    marginBottom: 20,
  },
  card: {
    background: "#fffdf8",
    border: "1px solid #eadcc3",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    margin: "0 0 14px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    margin: "13px 0 6px",
  },
  input: {
    width: "100%",
    padding: 12,
    border: "1px solid #d9c49f",
    borderRadius: 10,
    fontSize: 15,
    background: "#fff",
    color: "#402b20",
  },
  primaryButton: {
    width: "100%",
    border: 0,
    borderRadius: 11,
    padding: 14,
    marginTop: 18,
    background: "#896333",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  emergencyCard: {
    background: "#fff1f0",
    border: "1px solid #edc5c1",
    borderRadius: 16,
    padding: 16,
    marginBottom: 17,
  },
  emergencyTitle: {
    color: "#9b2929",
    fontSize: 17,
    margin: "0 0 8px",
  },
  emergencyText: {
    color: "#79504c",
    fontSize: 13,
    lineHeight: 1.6,
    margin: "0 0 14px",
  },
  emergencyButton: {
    width: "100%",
    border: 0,
    borderRadius: 10,
    background: "#a52a2a",
    color: "#fff",
    padding: 13,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    padding: 12,
    borderRadius: 10,
    background: "#fde7e7",
    color: "#a12626",
    marginBottom: 14,
    fontSize: 13,
  },
  success: {
    padding: 12,
    borderRadius: 10,
    background: "#e2f5e8",
    color: "#20723b",
    marginBottom: 14,
    fontSize: 13,
  },
  refreshButton: {
    border: "1px solid #d9c49f",
    borderRadius: 8,
    padding: "7px 10px",
    background: "#fffaf0",
    color: "#67451f",
    cursor: "pointer",
  },
  empty: {
    color: "#806c58",
    fontSize: 13,
    textAlign: "center",
    padding: 15,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  staffItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    border: "1px solid #eadcc3",
    borderRadius: 12,
  },
  staffInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minWidth: 0,
  },
  staffName: {
    fontSize: 15,
  },
  staffDetail: {
    color: "#806c58",
    fontSize: 12,
    overflowWrap: "anywhere",
  },
  status: {
    display: "inline-block",
    width: "fit-content",
    padding: "4px 8px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    marginTop: 3,
  },
  statusButton: {
    flexShrink: 0,
    border: 0,
    borderRadius: 8,
    color: "#fff",
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  logCount: {
    fontSize: 11,
    color: "#806c58",
  },
  logList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  logItem: {
    padding: 12,
    border: "1px solid #eadcc3",
    borderRadius: 11,
    background: "#fff",
  },
  logTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 13,
  },
  logRole: {
    color: "#806c58",
    fontSize: 11,
  },
  logAction: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 8,
  },
  logMeta: {
    color: "#806c58",
    fontSize: 12,
    marginTop: 5,
  },
  logDate: {
    color: "#9b8a77",
    fontSize: 11,
    marginTop: 7,
  },
};
    
