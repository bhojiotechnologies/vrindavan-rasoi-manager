import { useEffect, useState } from "react";

import {
  createStaffAccount,
  getStaffAccounts,
  setStaffStatus,
  type StaffAccount,
} from "./staffService";

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#fffaf0",
    color: "#402b20",
    border: "1px solid #eadcc3",
    borderRadius: 18,
    padding: 15,
  },
  heading: {
    fontSize: 21,
    fontWeight: 800,
    margin: "4px 0 6px",
  },
  subtitle: {
    color: "#806c58",
    fontSize: 13,
    marginBottom: 18,
  },
  card: {
    background: "#fffdf8",
    border: "1px solid #eadcc3",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    margin: "12px 0 6px",
  },
  input: {
    width: "100%",
    minHeight: 44,
    border: "1px solid #d9c49f",
    borderRadius: 9,
    padding: "10px 12px",
    fontSize: 15,
    background: "#ffffff",
    color: "#402b20",
  },
  button: {
    width: "100%",
    border: 0,
    borderRadius: 10,
    padding: 13,
    marginTop: 16,
    background: "#896333",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d9c49f",
    borderRadius: 9,
    padding: "9px 12px",
    background: "#fffaf0",
    color: "#67451f",
    fontWeight: 700,
    cursor: "pointer",
  },
  message: {
    padding: 11,
    borderRadius: 9,
    background: "#f2e8d5",
    color: "#70542f",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 1.5,
  },
  staffCard: {
    border: "1px solid #eadcc3",
    borderRadius: 12,
    padding: 13,
    marginTop: 10,
    background: "#fffdf8",
  },
  muted: {
    color: "#806c58",
    fontSize: 12,
    marginTop: 5,
  },
};

export default function StaffManagement() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function refreshStaff() {
    setLoading(true);

    try {
      const data = await getStaffAccounts();
      setStaffList(data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Staff सूची लोड नहीं हुई।"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshStaff();
  }, []);

  async function handleCreate(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      await createStaffAccount({
        name,
        username,
        password,
      });

      setName("");
      setUsername("");
      setPassword("");

      await refreshStaff();

      setMessage(
        "Staff Account सफलतापूर्वक बन गया। अब Staff अपनी ID और Password से Login कर सकता है।"
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Staff Account नहीं बन पाया।"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(
    staff: StaffAccount
  ) {
    const nextStatus =
      staff.status === "active" ? "inactive" : "active";

    const confirmed = window.confirm(
      `${staff.name} का Account ${
        nextStatus === "active" ? "Active" : "Inactive"
      } करना चाहते हैं?`
    );

    if (!confirmed) return;

    setMessage("");

    try {
      await setStaffStatus(staff.uid, nextStatus);
      await refreshStaff();

      setMessage(
        `${staff.name} का Account ${
          nextStatus === "active" ? "Active" : "Inactive"
        } कर दिया गया।`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Account Status अपडेट नहीं हुआ।"
      );
    }
  }

  return (
    <section style={styles.page}>
      <h2 style={styles.heading}>Staff Management</h2>

      <p style={styles.subtitle}>
        नया Staff Account बनाएँ और पुराने Staff का Access नियंत्रित करें।
      </p>

      {message && (
        <div style={styles.message} role="status">
          {message}
        </div>
      )}

      <form style={styles.card} onSubmit={handleCreate}>
        <h3>नया Staff Account बनाएँ</h3>

        <label style={styles.label}>Staff का नाम</label>
        <input
          style={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="जैसे Rahul Kumar"
          required
          minLength={2}
        />

        <label style={styles.label}>Staff Login ID</label>
        <input
          style={styles.input}
          value={username}
          onChange={(event) =>
            setUsername(
              event.target.value.toUpperCase().replace(/\s/g, "")
            )
          }
          placeholder="जैसे RAHUL01"
          autoCapitalize="characters"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9]+"
        />

        <p style={styles.muted}>
          ID में केवल English अक्षर और अंक रखें।
        </p>

        <label style={styles.label}>Login Password</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="कम से कम 6 अक्षर"
          autoComplete="new-password"
          minLength={6}
          required
        />

        <button
          style={styles.button}
          type="submit"
          disabled={saving}
        >
          {saving ? "Account बनाया जा रहा है..." : "Staff Account बनाएँ"}
        </button>
      </form>

      <div style={styles.card}>
        <h3>Staff की सूची</h3>

        {loading ? (
          <p style={styles.muted}>Staff सूची लोड हो रही है...</p>
        ) : staffList.length === 0 ? (
          <p style={styles.muted}>
            अभी कोई Staff Account नहीं बनाया गया है।
          </p>
        ) : (
          staffList.map((staff) => (
            <div key={staff.uid} style={styles.staffCard}>
              <strong>{staff.name}</strong>

              <div style={styles.muted}>
                Login ID: <strong>{staff.username}</strong>
              </div>

              <div style={styles.muted}>
                स्थिति:{" "}
                <strong>
                  {staff.status === "active" ? "Active" : "Inactive"}
                </strong>
              </div>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => void handleStatusChange(staff)}
              >
                {staff.status === "active"
                  ? "Account बंद करें"
                  : "Account चालू करें"}
              </button>
            </div>
          ))
        )}

        <button
          type="button"
          style={styles.button}
          onClick={() => void refreshStaff()}
          disabled={loading}
        >
          सूची Refresh करें
        </button>
      </div>
    </section>
  );
}
