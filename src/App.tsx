import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";

import {
  doc,
  onSnapshot,
} from "firebase/firestore";

import { auth, db } from "./firebase";

import ItemMaster from "./ItemMaster";
import SalesBilling from "./SalesBilling";
import CustomerManagement from "./CustomerManagement";
import OperationsManagement from "./OperationsManagement";
import StaffManagement from "./StaffManagement";
import BusinessProfileSettings from "./BusinessProfileSettings";

type UserProfile = {
  uid?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: "owner" | "staff" | string;
  status?: "active" | "inactive" | string;
};

type DashboardItem = {
  icon: string;
  title: string;
  subtitle: string;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

// Owner के सभी Dashboard Modules
const ownerDashboardItems: DashboardItem[] = [
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
    icon: "👨‍💼",
    title: "Staff Management",
    subtitle: "Staff Account प्रबंधन",
  },
  {
    icon: "⚙️",
    title: "Settings",
    subtitle: "ऐप की सेटिंग",
  },
];

// Staff के लिए सीमित Modules
const staffDashboardItems: DashboardItem[] = [
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
    icon: "🗑️",
    title: "Wastage",
    subtitle: "खराब सामान का हिसाब",
  },
];

const isOperationsModule = (module: string) =>
  [
    "Suppliers",
    "Purchase",
    "Inventory",
    "Expenses",
    "Wastage",
  ].includes(module);

const getInitialTab = (module: string) => {
  switch (module) {
    case "Purchase":
      return "purchase";
    case "Inventory":
      return "inventory";
    case "Expenses":
      return "expenses";
    case "Wastage":
      return "wastage";
    default:
      return "suppliers";
  }
};

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  const [error, setError] = useState("");
  const [selectedModule, setSelectedModule] = useState("");

  // Authentication और Live User Profile
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        setUser(currentUser);
        setProfile(null);
        setSelectedModule("");
        setError("");

        if (!currentUser) {
          setLoading(false);
          return;
        }

        setLoading(true);

        const userRef = doc(
          db,
          "users",
          currentUser.uid
        );

        unsubscribeProfile = onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setProfile(
                snapshot.data() as UserProfile
              );
              setError("");
            } else {
              setProfile(null);
              setError(
                "आपका User Profile नहीं मिला। Owner से संपर्क करें।"
              );
            }

            setLoading(false);
          },
          (err) => {
            console.error("Profile listener error:", err);

            setProfile(null);
            setError(
              "User Profile लोड नहीं हो पाया। इंटरनेट और Security Rules जाँचें।"
            );
            setLoading(false);
          }
        );
      }
    );

    return () => {
      unsubscribeAuth();

      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  // Owner Email या Staff ID से Login
  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    const identifier = email.trim();

    if (!identifier || !password) {
      setError(
        "कृपया Email / Staff ID और Password भरें।"
      );
      return;
    }

    setLoginLoading(true);

    try {
      const loginEmail = identifier.includes("@")
        ? identifier
        : `${identifier.toLowerCase()}@staff.vrindavanrasoi.com`;

      await signInWithEmailAndPassword(
        auth,
        loginEmail,
        password
      );
    } catch (err) {
      console.error("Login error:", err);

      setError(
        "Login नहीं हुआ। Email / Staff ID और Password जाँचें।"
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

  const isActiveStaff =
    user !== null &&
    profile !== null &&
    profile.status === "active" &&
    profile.role === "staff";

  // Owner और Staff के लिए साझा Module Renderer
  const renderModule = (role: "owner" | "staff") => {
    if (!selectedModule) {
      return null;
    }

    // Staff को केवल अनुमत Modules
    if (
      role === "staff" &&
      !staffDashboardItems.some(
        (item) => item.title === selectedModule
      )
    ) {
      return (
        <div className="module-card">
          <h2>Access Denied</h2>
          <p>आपको इस Module की अनुमति नहीं है।</p>
        </div>
      );
    }

    const backButton = (
      <button
        className="owner-back"
        type="button"
        onClick={() => setSelectedModule("")}
      >
        ← Dashboard पर वापस जाएँ
      </button>
    );

    if (selectedModule === "Item Master") {
      if (role !== "owner") return null;

      return (
        <section className="module-container">
          {backButton}
          <ItemMaster role="owner" />
        </section>
      );
    }

    if (selectedModule === "Staff Management") {
      if (role !== "owner") return null;

      return (
        <section className="module-container">
          {backButton}
          <StaffManagement />
        </section>
      );
    }

    // Settings अलग Owner-only Module है
    if (selectedModule === "Settings") {
      if (role !== "owner") return null;

      return (
        <section className="module-container">
          {backButton}
          <BusinessProfileSettings />
        </section>
      );
    }

    if (selectedModule === "Sales & Billing") {
      return (
        <section className="module-container">
          {backButton}
          <SalesBilling role={role} />
        </section>
      );
    }

    if (selectedModule === "Customers") {
      return (
        <section className="module-container">
          {backButton}
          <CustomerManagement role={role} />
        </section>
      );
    }

    if (isOperationsModule(selectedModule)) {
      return (
        <section className="module-container">
          {backButton}
          <OperationsManagement
            role={role}
            initialTab={getInitialTab(selectedModule)}
          />
        </section>
      );
    }

    return (
      <section className="module-container">
        {backButton}
        <div className="module-card">
          <h2>{selectedModule}</h2>
          <p>
            यह सुविधा अभी उपलब्ध नहीं कराई गई है।
          </p>
        </div>
      </section>
    );
  };

  // OWNER DASHBOARD
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

    return (
      <main className="app-shell">
        <DashboardStyles />

        <div className="owner-app">
          <DashboardHeader
            role="OWNER ACCOUNT"
          />

          {selectedModule ? (
            renderModule("owner")
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

              <ModuleGrid
                items={ownerDashboardItems}
                onSelect={setSelectedModule}
              />

              <div className="owner-notice">
                <strong>ध्यान दें:</strong> Dashboard के
                आँकड़े अभी शुरुआती स्थिति में शून्य हैं।
                वास्तविक आँकड़े जोड़ने का काम अगले चरण में
                किया जाएगा।
              </div>
            </>
          )}

          <LogoutButton onClick={handleLogout} />

          <DashboardFooter />
        </div>
      </main>
    );
  }

  // STAFF DASHBOARD
  if (isActiveStaff) {
    return (
      <main className="app-shell">
        <DashboardStyles />

        <div className="owner-app">
          <DashboardHeader
            role="STAFF ACCOUNT"
          />

          {selectedModule ? (
            renderModule("staff")
          ) : (
            <>
              <section className="owner-welcome">
                <h2>
                  🙏 राधे राधे!
                  {profile?.name
                    ? ` ${profile.name}`
                    : ""}
                </h2>

                <p>
                  वृंदावन रसोई Staff Dashboard
                </p>

                <p className="staff-id-line">
                  Staff ID: {profile?.username ?? "—"}
                </p>
              </section>

              <h3 className="owner-section-title">
                आपके कार्य
              </h3>

              <ModuleGrid
                items={staffDashboardItems}
                onSelect={setSelectedModule}
              />

              <div className="owner-notice">
                आप Staff Account से Login हैं।
                केवल अनुमत Modules ही उपलब्ध हैं।
                पुराने रिकॉर्ड में बदलाव और अन्य
                Owner सुविधाएँ उपलब्ध नहीं हैं।
              </div>
            </>
          )}

          <LogoutButton onClick={handleLogout} />

          <DashboardFooter />
        </div>
      </main>
    );
  }

  // INACTIVE या UNKNOWN ACCOUNT
  if (user) {
    return (
      <main className="app-shell">
        <section className="login-card">
          <div className="brand-mark">VR</div>

          <p className="eyebrow">
            ACCOUNT ACCESS
          </p>

          <h1>वृंदावन रसोई</h1>

          <div className="dashboard-card">
            <h2>Account Access नहीं है</h2>

            <p>
              भूमिका: {profile?.role ?? "अज्ञात"}
            </p>

            <p>
              स्थिति: {profile?.status ?? "अज्ञात"}
            </p>

            <p className="error-message">
              आपका Account Inactive है या उसे
              Dashboard की अनुमति नहीं है।
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
        </section>
      </main>
    );
  }

  // LOGIN SCREEN
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

        <form
          className="login-form"
          onSubmit={handleLogin}
        >
          <h2>Business Login</h2>

          <label htmlFor="email">
            Owner Email / Staff ID
          </label>

          <input
            id="email"
            type="text"
            placeholder="Email या Staff ID लिखें"
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

        <p className="footer-note">
          VRINDAVAN RASOI BUSINESS MANAGER
        </p>
      </section>
    </main>
  );
}

function DashboardHeader({
  role,
}: {
  role: string;
}) {
  return (
    <header className="owner-header">
      <div className="owner-top">
        <div className="owner-brand">
          VRINDAVAN RASOI
        </div>

        <span className="owner-role">
          {role}
        </span>
      </div>

      <h1>वृंदावन रसोई</h1>

      <p>
        जहाँ स्वाद और सुकून साथ मिलते हैं
      </p>
    </header>
  );
}

function ModuleGrid({
  items,
  onSelect,
}: {
  items: DashboardItem[];
  onSelect: (module: string) => void;
}) {
  return (
    <section className="owner-modules">
      {items.map((item) => (
        <button
          className="owner-module"
          key={item.title}
          type="button"
          onClick={() => onSelect(item.title)}
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
  );
}

function LogoutButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      className="owner-logout"
      type="button"
      onClick={onClick}
    >
      Logout
    </button>
  );
}

function DashboardFooter() {
  return (
    <footer className="owner-footer">
      VRINDAVAN RASOI BUSINESS MANAGER
    </footer>
  );
}

function DashboardStyles() {
  return (
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

      .staff-id-line {
        margin-top: 8px !important;
        font-weight: 700;
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

      .module-container {
        margin-top: 20px;
      }

      .module-card {
        background: #fffdf8;
        border: 1px solid #eadcc3;
        border-radius: 15px;
        padding: 20px;
        margin-top: 10px;
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
  );
}

export default App;
