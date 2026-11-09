
import { FormEvent, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

type Profile = {
  role?: string;
  status?: string;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (current) => {
      setUser(current);
      setProfile(null);
      if (current) {
        try {
          const snap = await getDoc(doc(db, "users", current.uid));
          if (snap.exists()) setProfile(snap.data() as Profile);
          else setError("इस खाते का users प्रोफाइल नहीं मिला।");
        } catch {
          setError("प्रोफाइल नहीं पढ़ा जा सका। Security Rules जाँचें।");
        }
      }
    });
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError("Login नहीं हुआ। Email और Password जाँचें।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel">
        <div className="mark">श्री</div>
        <p className="eyebrow">BUSINESS MANAGER</p>
        <h1>वृंदावन रसोई</h1>
        <p className="tagline">जहाँ स्वाद और सुकून साथ मिलते हैं</p>
        <div className="divider" />

        {user ? (
          <>
            <h2>Login सफल</h2>
            <div className="notice">
              <p>{user.email}</p>
              <p>Role: {profile?.role ?? "जाँच जारी है"}</p>
              <p>Status: {profile?.status ?? "जाँच जारी है"}</p>
            </div>
            <button className="secondary" onClick={() => signOut(auth)}>
              Logout
            </button>
          </>
        ) : (
          <>
            <h2>Login</h2>
            <p className="muted">अधिकृत Email और Password दर्ज करें।</p>
            <form onSubmit={login}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="आपका Email"
              />
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
              />
              <button disabled={busy}>
                {busy ? "प्रतीक्षा करें…" : "Login करें"}
              </button>
            </form>
          </>
        )}

        {error && <p className="error">{error}</p>}
        <p className="foot">सुरक्षित Business Management System</p>
      </section>
    </main>
  );
}
