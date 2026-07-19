import React, { useEffect, useMemo, useRef, useState } from "react";

const EMPTY_SOLUTION = Array(6).fill("");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createSolutionValues(initialSolution = "") {
  return Array.from({ length: 6 }, (_, index) => {
    const value = Array.from(initialSolution)[index];

    return value && value !== " " ? value : "";
  });
}

function serializeSolution(values) {
  return values.map(value => value || " ").join("");
}

export default function SubmissionDialog({
  initialSolution = "",
  isSubmitting = false,
  errorMessage = "",
  successMessage = "",
  onClose,
  onSubmit
}) {
  const dialogRef = useRef(null);
  const solutionRefs = useRef([]);
  const [solution, setSolution] = useState(() => (
    createSolutionValues(initialSolution)
  ));
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
  const canSubmit = isValid && !isSubmitting && !successMessage;

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

  const focusSolutionPosition = (index) => {
    solutionRefs.current[index]?.focus();
  };

  const updateSolutionPosition = (index, value) => {
    const nextValue = Array.from(value).pop() || "";

    setSolution(prev => {
      const next = [...prev];
      next[index] = nextValue;
      return next;
    });

    if (nextValue && index < solution.length - 1) {
      focusSolutionPosition(index + 1);
    }
  };

  const handleSolutionKeyDown = (event, index) => {
    if (event.key === "Backspace" && !solution[index] && index > 0) {
      event.preventDefault();
      focusSolutionPosition(index - 1);
    }
  };

  const handleSolutionPaste = (event, index) => {
    const pastedText = event.clipboardData.getData("text");

    if (!pastedText) return;

    event.preventDefault();

    const pastedCharacters = Array.from(pastedText).slice(0, 6 - index);

    setSolution(prev => {
      const next = [...prev];

      pastedCharacters.forEach((character, characterIndex) => {
        next[index + characterIndex] = character;
      });

      return next;
    });

    focusSolutionPosition(
      Math.min(index + pastedCharacters.length, solution.length - 1)
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!canSubmit) return;

    onSubmit({
      solution: serializeSolution(solution),
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
            {EMPTY_SOLUTION.map((_, index) => (
              <input
                key={index}
                ref={(element) => {
                  solutionRefs.current[index] = element;
                }}
                aria-label={`Lösningsord position ${index + 1}`}
                maxLength="1"
                value={solution[index]}
                onChange={(event) => {
                  updateSolutionPosition(index, event.target.value);
                }}
                onKeyDown={(event) => {
                  handleSolutionKeyDown(event, index);
                }}
                onPaste={(event) => {
                  handleSolutionPaste(event, index);
                }}
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

        {errorMessage && (
          <div
            role="alert"
            style={{
              color: "#9f1239",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              padding: "8px"
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            style={{
              color: "#14532d",
              background: "#dcfce7",
              border: "1px solid #bbf7d0",
              padding: "8px"
            }}
          >
            {successMessage}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px"
          }}
        >
          <button type="submit" disabled={!canSubmit}>
            {isSubmitting ? "Skickar..." : "Skicka"}
          </button>
          <button type="button" onClick={onClose}>
            Avbryt
          </button>
        </div>
      </form>
    </div>
  );
}
