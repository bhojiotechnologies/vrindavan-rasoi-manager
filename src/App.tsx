import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./firebase";

type UserProfile = {
  role?: string;
  status?: string;
};

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setProfile(null);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
          setProfile(userSnapshot.data() as UserProfile);
        } else {
          setError("आपका User Profile नहीं मिला। Owner से संपर्क करें।");
        }
      } catch (err) {
        console.error("Profile error:", err);
        setError("User Profile लोड नहीं हो पाया। इंटरनेट और Security Rules जाँचें।");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("कृपया Email और Password भरें।");
      return;
    }

    setLoginLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      console.error("Login error:", err);
      setError("Login नहीं हुआ। Email और Password जाँचें।");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    setError("");

    try {
      await signOut(auth);
      setProfile(null);
      setEmail("");
      setPassword("");
    } catch (err) {
      console.error("Logout error:", err);
      setError("Logout नहीं हो पाया। दोबारा प्रयास करें।");
    }
  };

  if (loading) {
    return (
      <main className="app-shell">
        <section className="login-card">
          <div className="brand-mark">VR</div>
          <h1>वृंदावन रसोई</h1>
          <p>कृपया प्रतीक्षा करें...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="login-card">
        <div className="brand-mark">VR</div>

        <p className="eyebrow">BUSINESS MANAGER</p>

        <h1>वृंदावन रसोई</h1>

        <p className="subtitle">
          जहाँ स्वाद और सुकून साथ मिलते हैं
        </p>

        {user && profile ? (
          <div className="dashboard-card">
            <h2>स्वागत है!</h2>

            <p>
              Login सफल हुआ है।
            </p>

            <div className="status-pill">
              भूमिका: {profile.role ?? "अज्ञात"}
            </div>

            <p>
              Account Status: {profile.status ?? "अज्ञात"}
            </p>

            {profile.status !== "active" && (
              <p className="error-message">
                आपका Account Active नहीं है। Owner से संपर्क करें।
              </p>
            )}

            <button
              className="primary-button"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleLogin}>
            <h2>Business Login</h2>

            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="अपना Email लिखें"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="अपना Password लिखें"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={loginLoading}
            >
              {loginLoading ? "Login हो रहा है..." : "Login करें"}
            </button>
          </form>
        )}

        <p className="footer-note">
          VRINDAVAN RASOI BUSINESS MANAGER
        </p>
      </section>
    </main>
  );
}

export default App;
