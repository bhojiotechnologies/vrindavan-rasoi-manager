import { useEffect, useRef, useState } from "react";
import {
  deleteField,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "./firebase";

interface BusinessProfile {
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  logoDataUrl?: string;
  logoUpdatedAt?: number;
}

const SETTINGS_REF = doc(db, "settings", "businessProfile");
const MAX_LOGO_BYTES = 450 * 1024;

const defaultProfile: BusinessProfile = {
  businessName: "वृंदावन रसोई",
  tagline: "जहाँ स्वाद और सुकून साथ मिलते हैं",
  address: "बिलंदा, फतेहपुर, उत्तर प्रदेश",
  phone: "7007418571",
};

function compressLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("कृपया Image File चुनें।"));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("मूल Logo 10 MB से छोटा होना चाहिए।"));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");

        let scale = Math.min(
          1,
          1000 / Math.max(image.width, image.height)
        );

        let result = "";

        for (let attempt = 0; attempt < 12; attempt++) {
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Image Compression उपलब्ध नहीं है।");
          }

          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const quality = Math.max(0.35, 0.86 - attempt * 0.045);

          result = canvas.toDataURL("image/webp", quality);

          const estimatedBytes = Math.ceil(
            (result.length * 3) / 4
          );

          if (
            result.startsWith("data:image/webp") &&
            estimatedBytes <= MAX_LOGO_BYTES
          ) {
            URL.revokeObjectURL(objectUrl);
            resolve(result);
            return;
          }

          scale *= 0.82;
        }

        throw new Error(
          "Logo 450 KB तक Compress नहीं हुआ। छोटी Image चुनें।"
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Logo Image पढ़ी नहीं जा सकी।"));
    };

    image.src = objectUrl;
  });
}

export default function BusinessProfileSettings() {
  const [profile, setProfile] =
    useState<BusinessProfile>(defaultProfile);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const snapshot = await getDoc(SETTINGS_REF);

        if (!mounted) return;

        if (snapshot.exists()) {
          const data = snapshot.data();

          setProfile({
            businessName: String(
              data.businessName ?? defaultProfile.businessName
            ),
            tagline: String(
              data.tagline ?? defaultProfile.tagline
            ),
            address: String(
              data.address ?? defaultProfile.address
            ),
            phone: String(
              data.phone ?? defaultProfile.phone
            ),
            logoDataUrl:
              typeof data.logoDataUrl === "string"
                ? data.logoDataUrl
                : undefined,
            logoUpdatedAt:
              typeof data.logoUpdatedAt === "number"
                ? data.logoUpdatedAt
                : undefined,
          });
        }
      } catch (err) {
        console.error("Business Profile load error:", err);
        if (mounted) {
          setError("Business Profile लोड नहीं हो पाया।");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  function updateField(
    field: "businessName" | "tagline" | "address" | "phone",
    value: string
  ) {
    setProfile((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleLogoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setMessage("");
    setUploading(true);

    try {
      const logoDataUrl = await compressLogo(file);

      setProfile((previous) => ({
        ...previous,
        logoDataUrl,
        logoUpdatedAt: Date.now(),
      }));

      setMessage(
        "Logo तैयार है। इसे स्थायी रूप से सुरक्षित करने के लिए Save Changes दबाएँ।"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Logo तैयार नहीं हो पाया।"
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function saveProfile() {
    if (!auth.currentUser) {
      setError("Owner Login उपलब्ध नहीं है।");
      return;
    }

    if (
      !profile.businessName.trim() ||
      !profile.phone.trim()
    ) {
      setError("Business Name और Mobile Number जरूरी हैं।");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await setDoc(
        SETTINGS_REF,
        {
          businessName: profile.businessName.trim(),
          tagline: profile.tagline.trim(),
          address: profile.address.trim(),
          phone: profile.phone.trim(),
          ...(profile.logoDataUrl
            ? {
                logoDataUrl: profile.logoDataUrl,
                logoUpdatedAt:
                  profile.logoUpdatedAt ?? Date.now(),
              }
            : {}),
          updatedAt: Date.now(),
          updatedBy: auth.currentUser.uid,
        },
        { merge: true }
      );

      setMessage("Business Profile सफलतापूर्वक Save हो गया।");
    } catch (err) {
      console.error("Business Profile save error:", err);

      setError(
        "Save नहीं हो पाया। Firestore Rules और Logo Size जाँचें।"
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeLogo() {
    if (!auth.currentUser || !profile.logoDataUrl) return;

    const confirmed = window.confirm(
      "क्या आप वर्तमान Logo हटाना चाहते हैं?"
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await setDoc(
        SETTINGS_REF,
        {
          logoDataUrl: deleteField(),
          logoUpdatedAt: deleteField(),
          updatedAt: Date.now(),
          updatedBy: auth.currentUser.uid,
        },
        { merge: true }
      );

      setProfile((previous) => ({
        ...previous,
        logoDataUrl: undefined,
        logoUpdatedAt: undefined,
      }));

      setMessage("वर्तमान Logo हटा दिया गया।");
    } catch (err) {
      console.error("Logo removal error:", err);
      setError("Logo हटाया नहीं जा सका।");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Business Profile लोड हो रहा है...</p>;
  }

  return (
    <main style={styles.page}>
      <h2 style={styles.heading}>🏪 Business Profile</h2>

      <p style={styles.subtitle}>
        Business की जानकारी और Invoice Logo प्रबंधित करें।
      </p>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <section style={styles.card}>
        <h3 style={styles.sectionTitle}>Business Logo</h3>

        <div style={styles.logoPreview}>
          {profile.logoDataUrl ? (
            <img
              src={profile.logoDataUrl}
              alt="Business Logo"
              style={styles.logoImage}
            />
          ) : (
            <div style={styles.logoPlaceholder}>
              VR
              <small>Logo नहीं लगाया गया</small>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoChange}
          style={styles.hiddenInput}
        />

        <button
          type="button"
          style={styles.primaryButton}
          disabled={uploading || saving}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading
            ? "Logo Compress हो रहा है..."
            : "📷 नया Logo चुनें"}
        </button>

        {profile.logoDataUrl && (
          <button
            type="button"
            style={styles.removeButton}
            disabled={saving || uploading}
            onClick={() => void removeLogo()}
          >
            Logo हटाएँ
          </button>
        )}

        <p style={styles.hint}>
          JPG, PNG या अन्य Image चुनें। ऐप इसे WebP में Compress करके
          अधिकतम 450 KB तक रखेगा।
        </p>
      </section>

      <section style={styles.card}>
        <h3 style={styles.sectionTitle}>
          Business Details
        </h3>

        <label style={styles.label}>Business Name</label>
        <input
          style={styles.input}
          value={profile.businessName}
          onChange={(event) =>
            updateField("businessName", event.target.value)
          }
          maxLength={100}
        />

        <label style={styles.label}>Tagline</label>
        <input
          style={styles.input}
          value={profile.tagline}
          onChange={(event) =>
            updateField("tagline", event.target.value)
          }
          maxLength={150}
        />

        <label style={styles.label}>Business Address</label>
        <textarea
          style={styles.textarea}
          value={profile.address}
          onChange={(event) =>
            updateField("address", event.target.value)
          }
          rows={3}
          maxLength={300}
        />

        <label style={styles.label}>Mobile Number</label>
        <input
          style={styles.input}
          type="tel"
          value={profile.phone}
          onChange={(event) =>
            updateField("phone", event.target.value)
          }
          maxLength={15}
        />

        <button
          type="button"
          style={styles.primaryButton}
          disabled={saving || uploading}
          onClick={() => void saveProfile()}
        >
          {saving ? "Save हो रहा है..." : "💾 Save Changes"}
        </button>
      </section>

      <div style={styles.notice}>
        <strong>Invoice नियम:</strong> नया Logo नए Invoice में इस्तेमाल
        होगा। पहले से जारी Invoice में सुरक्षित पुराना Logo ही रहेगा।
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: "100%",
    color: "#402b20",
    paddingBottom: 25,
  },
  heading: {
    fontSize: 23,
    margin: "5px 0",
  },
  subtitle: {
    color: "#806c58",
    fontSize: 13,
    marginBottom: 18,
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
    margin: "0 0 15px",
  },
  logoPreview: {
    width: "100%",
    minHeight: 170,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f8f3e8",
    border: "1px dashed #c9b28c",
    borderRadius: 12,
    padding: 15,
    marginBottom: 14,
  },
  logoImage: {
    maxWidth: "100%",
    maxHeight: 190,
    objectFit: "contain",
  },
  logoPlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "#896333",
    fontSize: 40,
    fontWeight: 800,
  },
  hiddenInput: {
    display: "none",
  },
  primaryButton: {
    width: "100%",
    padding: 13,
    border: 0,
    borderRadius: 10,
    background: "#896333",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 10,
  },
  removeButton: {
    width: "100%",
    padding: 11,
    border: 0,
    borderRadius: 10,
    background: "#f7e5e2",
    color: "#a12626",
    fontWeight: 700,
    marginTop: 9,
    cursor: "pointer",
  },
  hint: {
    fontSize: 12,
    lineHeight: 1.6,
    color: "#806c58",
    marginBottom: 0,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    margin: "13px 0 6px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    border: "1px solid #d9c49f",
    borderRadius: 9,
    fontSize: 15,
    background: "#fff",
    color: "#402b20",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    border: "1px solid #d9c49f",
    borderRadius: 9,
    fontSize: 15,
    background: "#fff",
    color: "#402b20",
    resize: "vertical",
  },
  success: {
    padding: 12,
    borderRadius: 9,
    background: "#e2f5e8",
    color: "#20723b",
    fontSize: 13,
    marginBottom: 13,
  },
  error: {
    padding: 12,
    borderRadius: 9,
    background: "#fde7e7",
    color: "#a12626",
    fontSize: 13,
    marginBottom: 13,
  },
  notice: {
    padding: 13,
    borderRadius: 10,
    background: "#f2e8d5",
    color: "#70542f",
    fontSize: 12,
    lineHeight: 1.6,
  },
};
      
