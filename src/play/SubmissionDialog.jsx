import React, { useEffect, useMemo, useRef, useState } from "react";

const EMPTY_SOLUTION = Array(6).fill("");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SubmissionDialog({ onClose, onSubmit }) {
  const dialogRef = useRef(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const isValid = useMemo(() => {
    return (
      name.trim() &&
      EMAIL_PATTERN.test(email.trim()) &&
      phone.trim()
    );
  }, [email, name, phone]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!isValid) return;

    onSubmit({
      solution: EMPTY_SOLUTION,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim()
    });
  };

  return (
    <div
      data-testid="submission-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-dialog-title"
        tabIndex="-1"
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fff",
          border: "1px solid #d6d6d6",
          borderRadius: "8px",
          padding: "20px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.22)",
          display: "flex",
          flexDirection: "column",
          gap: "14px"
        }}
      >
        <h2
          id="submission-dialog-title"
          style={{
            margin: 0,
            fontSize: "22px"
          }}
        >
          Skicka in tävlingsbidrag
        </h2>

        <div>
          <div style={{ marginBottom: "6px" }}>Lösningsord</div>
          <div
            aria-label="Lösningsord"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "6px"
            }}
          >
            {EMPTY_SOLUTION.map((value, index) => (
              <input
                key={index}
                aria-label={`Lösningsord position ${index + 1}`}
                readOnly
                value={value}
                placeholder={`${index + 1}`}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  textAlign: "center",
                  fontSize: "20px",
                  padding: "8px 0"
                }}
              />
            ))}
          </div>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          Namn *
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          E-post *
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          Telefonnummer *
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px"
          }}
        >
          <button type="submit" disabled={!isValid}>
            Skicka
          </button>
          <button type="button" onClick={onClose}>
            Avbryt
          </button>
        </div>
      </form>
    </div>
  );
}
