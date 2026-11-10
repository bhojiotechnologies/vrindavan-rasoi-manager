
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

import ItemMaster from "./ItemMaster";
import SalesBilling from "./SalesBilling";
import CustomerManagement from "./CustomerManagement";
import OperationsManagement from "./OperationsManagement";

type UserProfile = {
  role?: string;
  status?: string;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const dashboardItems = [
  {
    icon: "🧾",
    title: "Sales & Billing",
    subtitle: "बिक्री और बिल",
  },
  {
    icon: "👥",
    title: "Customers",
    subtitle: "ग्राहक और लेजर",
  },
  {
    icon: "💸",
    title: "Expenses",
    subtitle: "खर्च का हिसाब",
  },
  {
    icon: "📦",
    title: "Inventory",
    subtitle: "स्टॉक प्रबंधन",
  },
  {
    icon: "🍽️",
    title: "Item Master",
    subtitle: "मेनू और Item की कीमतें",
  },
  {
    icon: "🚚",
    title: "Suppliers",
    subtitle: "सप्लायर और भुगतान",
  },
  {
    icon: "📥",
    title: "Purchase",
    subtitle: "सामान की खरीद",
  },
  {
    icon: "📊",
    title: "Reports",
    subtitle: "बिक्री और रिपोर्ट",
  },
  {
    icon: "🗑️",
    title: "Wastage",
    subtitle: "खराब सामान का हिसाब",
  },
  {
    icon: "⚙️",
    title: "Settings",
    subtitle: "ऐप की सेटिंग",
  },
];

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  const [error, setError] = useState("");
  const [selectedModule, setSelectedModule] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
        setProfile(null);
        setSelectedModule("");
        setError("");

        if (!currentUser) {
          setLoading(false);
          return;
        }

        setLoading(true);

        try {
          const userRef = doc(
            db,
            "users",
            currentUser.uid
          );

          const snapshot = await getDoc(userRef);

          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          } else {
            setError(
              "आपका User Profile नहीं मिला। Owner से संपर्क करें।"
            );
          }
        } catch (err) {
          console.error("Profile error:", err);

          setError(
            "User Profile लोड नहीं हो पाया। इंटरनेट और Security Rules जाँचें।"
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("कृपया Email और Password भरें।");
      return;
    }

    setLoginLoading(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
    } catch (err) {
      console.error("Login error:", err);

      setError(
        "Login नहीं हुआ। Email और Password जाँचें।"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);

      setProfile(null);
      setEmail("");
      setPassword("");
      setSelectedModule("");
      setError("");
    } catch (err) {
      console.error("Logout error:", err);

      setError(
        "Logout नहीं हो पाया। दोबारा प्रयास करें।"
      );
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

  const isActiveOwner =
    user !== null &&
    profile !== null &&
    profile.status === "active" &&
    profile.role === "owner";

  if (isActiveOwner) {
    const stats = [
      {
        icon: "🧾",
        label: "आज की बिक्री",
        value: money(0),
      },
      {
        icon: "💸",
        label: "आज का खर्च",
        value: money(0),
      },
      {
        icon: "📈",
        label: "अनुमानित लाभ",
        value: money(0),
      },
      {
        icon: "💵",
        label: "Cash Balance",
        value: money(0),
      },
      {
        icon: "📱",
        label: "UPI Collection",
        value: money(0),
      },
      {
        icon: "👥",
        label: "ग्राहक एडवांस",
        value: money(0),
      },
      {
        icon: "🚚",
        label: "Supplier Outstanding",
        value: money(0),
      },
      {
        icon: "📦",
        label: "कुल स्टॉक",
        value: "0 Items",
      },
    ];

    const isOperationsModule = [
      "Suppliers",
      "Purchase",
      "Inventory",
      "Expenses",
      "Wastage",
    ].includes(selectedModule);

    const initialTab =
      selectedModule === "Purchase"
        ? "purchase"
        : selectedModule === "Inventory"
          ? "inventory"
          : selectedModule === "Expenses"
            ? "expenses"
            : selectedModule === "Wastage"
              ? "wastage"
              : "suppliers";

    return (
      <main className="app-shell">
        <style>{`
          * {
            box-sizing: border-box;
          }

          .owner-app {
            width: 100%;
            max-width: 900px;
            margin: auto;
            padding: 18px 14px 40px;
            color: #402b20;
          }

          .owner-header {
            background: #fffaf0;
            border: 1px solid #eadcc3;
            border-radius: 20px;
            padding: 20px;
            box-shadow: 0 5px 18px #4b32120c;
          }

          .owner-brand {
            color: #9b753d;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 3px;
          }

          .owner-header h1 {
            font-size: 28px;
            margin: 10px 0 4px;
          }

          .owner-header p {
            color: #806c58;
            margin: 0;
            font-size: 14px;
          }

          .owner-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }

          .owner-role {
            background: #efe3ca;
            color: #745126;
            border-radius: 30px;
            padding: 7px 12px;
            font-size: 12px;
            font-weight: 700;
          }

          .owner-welcome {
            margin: 22px 2px 14px;
          }

          .owner-welcome h2 {
            font-size: 21px;
            margin: 0 0 5px;
          }

          .owner-welcome p {
            margin: 0;
            color: #806c58;
            font-size: 13px;
          }

          .owner-section-title {
            font-size: 17px;
            margin: 24px 2px 12px;
          }

          .owner-stats {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 11px;
          }

          .owner-stat {
            background: #fffdf8;
            border: 1px solid #eadcc3;
            border-radius: 16px;
            padding: 15px 12px;
            min-height: 112px;
          }

          .owner-stat-icon {
            font-size: 22px;
          }

          .owner-stat-label {
            color: #806c58;
            font-size: 12px;
            margin-top: 9px;
          }

          .owner-stat-value {
            font-size: 19px;
            font-weight: 800;
            margin-top: 5px;
            overflow-wrap: anywhere;
          }

          .owner-modules {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 11px;
          }

          .owner-module {
            width: 100%;
            text-align: left;
            font-family: inherit;
            color: #402b20;
            background: #fffdf8;
            border: 1px solid #eadcc3;
            border-radius: 15px;
            padding: 15px 12px;
            min-height: 95px;
            cursor: pointer;
          }

          .owner-module:active {
            background: #f2e8d5;
            transform: scale(0.98);
          }

          .owner-module-icon {
            font-size: 23px;
          }

          .owner-module-title {
            font-size: 14px;
            font-weight: 800;
            margin-top: 7px;
          }

          .owner-module-sub {
            color: #806c58;
            font-size: 11px;
            margin-top: 3px;
          }

          .owner-notice {
            background: #f2e8d5;
            border-radius: 13px;
            padding: 13px;
            margin-top: 20px;
            color: #70542f;
            font-size: 12px;
            line-height: 1.6;
          }

          .owner-logout {
            width: 100%;
            margin-top: 20px;
            border: 0;
            border-radius: 13px;
            background: #896333;
            color: white;
            font-weight: 700;
            font-size: 15px;
            padding: 14px;
            cursor: pointer;
          }

          .owner-back {
            border: 1px solid #d9c49f;
            border-radius: 10px;
            background: #fffaf0;
            color: #67451f;
            padding: 10px 15px;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 15px;
            cursor: pointer;
          }

          .owner-footer {
            text-align: center;
            color: #8b7966;
            font-size: 11px;
            margin-top: 25px;
            letter-spacing: 1px;
          }

          @media (min-width: 650px) {
            .owner-stats {
              grid-template-columns: repeat(4, minmax(0, 1fr));
            }

            .owner-modules {
              grid-template-columns: repeat(4, minmax(0, 1fr));
            }
          }
        `}</style>

        <div className="owner-app">
          <header className="owner-header">
            <div className="owner-top">
              <div className="owner-brand">
                VRINDAVAN RASOI
              </div>

              <span className="owner-role">
                OWNER ACCOUNT
              </span>
            </div>

            <h1>वृंदावन रसोई</h1>

            <p>
              जहाँ स्वाद और सुकून साथ मिलते हैं
            </p>
          </header>

          {selectedModule === "Item Master" ? (
            <section style={{ marginTop: 20 }}>
              <button
                className="owner-back"
                type="button"
                onClick={() => setSelectedModule("")}
              >
                ← Dashboard पर वापस जाएँ
              </button>

              <ItemMaster role="owner" />
            </section>
          ) : selectedModule === "Sales & Billing" ? (
            <section style={{ marginTop: 20 }}>
              <button
                className="owner-back"
                type="button"
                onClick={() => setSelectedModule("")}
              >
                ← Dashboard पर वापस जाएँ
              </button>

              <SalesBilling role="owner" />
            </section>
          ) : selectedModule === "Customers" ? (
            <section style={{ marginTop: 20 }}>
              <button
                className="owner-back"
                type="button"
                onClick={() => setSelectedModule("")}
              >
                ← Dashboard पर वापस जाएँ
              </button>

              <CustomerManagement role="owner" />
            </section>
          ) : isOperationsModule ? (
            <section style={{ marginTop: 20 }}>
              <button
                className="owner-back"
                type="button"
                onClick={() => setSelectedModule("")}
              >
                ← Dashboard पर वापस जाएँ
              </button>

              <OperationsManagement
                role="owner"
                initialTab={initialTab}
              />
            </section>
          ) : (
            <>
              <section className="owner-welcome">
                <h2>🙏 राधे राधे! स्वागत है</h2>

                <p>
                  आपके Business का Owner Dashboard
                </p>
              </section>

              <h3 className="owner-section-title">
                आज का Business Overview
              </h3>

              <section className="owner-stats">
                {stats.map((item) => (
                  <div
                    className="owner-stat"
                    key={item.label}
                  >
                    <div className="owner-stat-icon">
                      {item.icon}
                    </div>

                    <div className="owner-stat-label">
                      {item.label}
                    </div>

                    <div className="owner-stat-value">
                      {item.value}
                    </div>
                  </div>
                ))}
              </section>

              <h3 className="owner-section-title">
                Business Management
              </h3>

              <section className="owner-modules">
                {dashboardItems.map((item) => (
                  <button
                    className="owner-module"
                    key={item.title}
                    type="button"
                    onClick={() =>
                      setSelectedModule(item.title)
                    }
                    aria-label={`${item.title} खोलें`}
                  >
                    <div className="owner-module-icon">
                      {item.icon}
                    </div>

                    <div className="owner-module-title">
                      {item.title}
                    </div>

                    <div className="owner-module-sub">
                      {item.subtitle}
                    </div>
                  </button>
                ))}
              </section>

              <div className="owner-notice">
                <strong>ध्यान दें:</strong> Dashboard के
                आँकड़े अभी शुरुआती स्थिति में शून्य हैं।
                वास्तविक आँकड़े जोड़ने का काम अगले चरण में
                किया जाएगा। Supplier, Purchase, Inventory,
                Expense और Wastage के शुरुआती Management
                Forms उपलब्ध हैं।
              </div>
            </>
          )}

          <button
            className="owner-logout"
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>

          <footer className="owner-footer">
            VRINDAVAN RASOI BUSINESS MANAGER
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="login-card">
        <div className="brand-mark">VR</div>

        <p className="eyebrow">
          BUSINESS MANAGER
        </p>

        <h1>वृंदावन रसोई</h1>

        <p className="subtitle">
          जहाँ स्वाद और सुकून साथ मिलते हैं
        </p>

        {user && profile ? (
          <div className="dashboard-card">
            <h2>Account Access</h2>

            <p>
              भूमिका: {profile.role ?? "अज्ञात"}
            </p>

            <p>
              स्थिति: {profile.status ?? "अज्ञात"}
            </p>

            <p className="error-message">
              आपका Account Active Owner Account नहीं है।
              कृपया Owner से संपर्क करें।
            </p>

            <button
              className="primary-button"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        ) : (
          <form
            className="login-form"
            onSubmit={handleLogin}
          >
            <h2>Business Login</h2>

            <label htmlFor="email">
              Email Address
            </label>

            <input
              id="email"
              type="email"
              placeholder="अपना Email लिखें"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="username"
              required
            />

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="अपना Password लिखें"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
            />

            {error && (
              <p
                className="error-message"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={loginLoading}
            >
              {loginLoading
                ? "Login हो रहा है..."
                : "Login करें"}
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
