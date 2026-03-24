import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";

const SelfRegister = () => {
  const { gymId } = useParams();
  const [searchParams] = useSearchParams();
  const gymName = searchParams.get("gym") || "Gym";

  const [form, setForm] = useState({
    name: "",
    age: "",
    mobile: "",
    whatsapp: "",
    email: "",
    weight: "",
    height: "",
    allergies: "",
    diseases: "",
    emergencyContact: "",
    emergencyName: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!form.mobile && !form.whatsapp) {
      setError("At least one phone number (Mobile or WhatsApp) is required");
      return;
    }

    setSubmitting(true);

    try {
      const { db } = await import("../config/firebase");
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );

      const registrationData = {
        ...form,
        gymId,
        status: "pending_approval",
        source: "self_registration",
        createdAt: Timestamp.now(),
        submittedAt: Timestamp.now(),
      };

      await addDoc(collection(db, "self_registrations"), registrationData);

      setSubmitted(true);
    } catch (err) {
      console.error("Registration error:", err);
      setError("Failed to submit registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Registration Submitted!
          </h2>
          <p className="text-gray-400 mb-4">
            Your details have been sent to <span className="text-white font-medium">{gymName}</span>.
            The gym staff will complete your registration and share your login credentials soon.
          </p>
          <p className="text-sm text-gray-500">You can close this page now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-8 h-8 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Member Registration</h1>
          <p className="text-gray-400 mt-1">{gymName}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">
              Personal Information
            </h3>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your full name"
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Age
              </label>
              <input
                type="number"
                name="age"
                value={form.age}
                onChange={handleChange}
                min="10"
                max="100"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your age"
              />
            </div>

            {/* Mobile */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="mobile"
                value={form.mobile}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="07XXXXXXXX"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                WhatsApp Number
              </label>
              <input
                type="tel"
                name="whatsapp"
                value={form.whatsapp}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="07XXXXXXXX"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>
          </div>

          {/* Health Info */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">
              Health Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  name="weight"
                  value={form.weight}
                  onChange={handleChange}
                  step="0.1"
                  min="20"
                  max="300"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="70"
                />
              </div>

              {/* Height */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  name="height"
                  value={form.height}
                  onChange={handleChange}
                  step="0.1"
                  min="100"
                  max="250"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="170"
                />
              </div>
            </div>

            {/* Allergies */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Allergies
              </label>
              <input
                type="text"
                name="allergies"
                value={form.allergies}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any known allergies"
              />
            </div>

            {/* Diseases */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Medical Conditions
              </label>
              <input
                type="text"
                name="diseases"
                value={form.diseases}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any medical conditions"
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">
              Emergency Contact
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Contact Name
              </label>
              <input
                type="text"
                name="emergencyName"
                value={form.emergencyName}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Emergency contact name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Contact Number
              </label>
              <input
                type="tel"
                name="emergencyContact"
                value={form.emergencyContact}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="07XXXXXXXX"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-xl font-semibold text-base transition active:scale-[0.98]"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Submitting...
              </span>
            ) : (
              "Submit Registration"
            )}
          </button>

          <p className="text-center text-xs text-gray-500">
            Your information will be shared with {gymName} for membership registration.
          </p>
        </form>
      </div>
    </div>
  );
};

export default SelfRegister;
