import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import AdminLayout from "../../components/AdminLayout";
import {
  User,
  Mail,
  Phone,
  Award,
  Briefcase,
  Users,
  CalendarDays,
  Pencil,
  Check,
  X,
  ShieldCheck,
  Building2,
  Loader2,
} from "lucide-react";

// Fields a trainer may edit about themselves. Role, username, gym and account
// status stay read-only — those are the gym admin's to change, and a trainer
// editing them here would silently diverge from what the admin sees.
const EDITABLE_FIELDS = [
  "name",
  "email",
  "phone",
  "specialization",
  "experience",
  "certification",
  "bio",
];

const emptyForm = () =>
  EDITABLE_FIELDS.reduce((form, key) => ({ ...form, [key]: "" }), {});

const inputClass =
  "w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5";

/** A read-only field: label above, value below, muted placeholder when unset. */
const Field = ({ icon: Icon, label, value, mono = false }) => (
  <div>
    <div className={labelClass}>{label}</div>
    <div className="flex items-start gap-2">
      {Icon && <Icon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />}
      <div
        className={`text-sm text-white ${mono ? "font-mono break-all" : ""} ${
          value ? "" : "text-gray-600"
        }`}
      >
        {value || "Not set"}
      </div>
    </div>
  </div>
);

/** A single headline number. Kept flat and quiet — this is not a dashboard. */
const Stat = ({ icon: Icon, value, label }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
      {Icon && <Icon className="w-4 h-4 text-blue-400" />}
    </div>
    <div className="min-w-0">
      <div className="text-lg font-bold text-white leading-tight">{value}</div>
      <div className="text-xs text-gray-500 truncate">{label}</div>
    </div>
  </div>
);

const InstructorProfile = () => {
  const { user: currentUser, updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ classes: 0, members: 0 });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchProfile = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const { db } = await import("../../config/firebase");
      const { doc, getDoc, collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      const snap = await getDoc(doc(db, "users", currentUser.id));
      const data = snap.exists()
        ? { id: snap.id, ...snap.data() }
        : { ...currentUser };
      setProfile(data);
      setForm(
        EDITABLE_FIELDS.reduce(
          (form, key) => ({ ...form, [key]: data[key] || "" }),
          {}
        )
      );

      // Two cheap counts that make the profile worth opening: what this
      // trainer is actually responsible for. There is no "assigned trainer"
      // field on a member, so "members trained" is the number of DISTINCT
      // members this trainer has assigned a workout to — the closest thing
      // the data models to a trainer's own roster. Both queries are
      // equality-only, so neither needs a composite index.
      const [classesSnap, assignmentsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "classes"),
            where("gymId", "==", currentUser.gymId),
            where("instructorId", "==", currentUser.id)
          )
        ),
        getDocs(
          query(
            collection(db, "workout_assignments"),
            where("gymId", "==", currentUser.gymId),
            where("assignedBy", "==", currentUser.id)
          )
        ),
      ]);
      const memberIds = new Set(
        assignmentsSnap.docs.map((d) => d.data().memberId).filter(Boolean)
      );
      setStats({ classes: classesSnap.size, members: memberIds.size });
    } catch (err) {
      console.error("Error loading instructor profile:", err);
      setError("Could not load your profile. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const startEditing = () => {
    setError("");
    setForm(
      EDITABLE_FIELDS.reduce(
        (next, key) => ({ ...next, [key]: profile?.[key] || "" }),
        {}
      )
    );
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setError("");
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("Your name cannot be empty.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const { db } = await import("../../config/firebase");
      const { doc, updateDoc, Timestamp } = await import("firebase/firestore");

      const changes = EDITABLE_FIELDS.reduce(
        (next, key) => ({ ...next, [key]: (form[key] || "").trim() }),
        {}
      );

      await updateDoc(doc(db, "users", currentUser.id), {
        ...changes,
        updatedAt: Timestamp.now(),
      });

      setProfile((previous) => ({ ...previous, ...changes }));
      // The session is a localStorage snapshot taken at login, so it has to be
      // refreshed too or the sidebar keeps showing the old name.
      updateUser?.({ name: changes.name, email: changes.email });
      setIsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Error saving instructor profile:", err);
      setError("Saving failed. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const setField = (key) => (e) =>
    setForm((previous) => ({ ...previous, [key]: e.target.value }));

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  const displayName = profile?.name || profile?.username || "Trainer";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  const isActive = profile?.isActive !== false;
  const joined = profile?.createdAt?.toDate
    ? profile.createdAt.toDate()
    : profile?.createdAt
      ? new Date(profile.createdAt)
      : null;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
        {/* Identity header */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          <div className="px-5 sm:px-6 pb-5 -mt-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex items-end gap-4 min-w-0">
                <div className="w-20 h-20 rounded-2xl bg-gray-900 border-4 border-gray-800 flex items-center justify-center flex-shrink-0">
                  {profile?.profileImageUrl ? (
                    <img
                      src={profile.profileImageUrl}
                      alt={displayName}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-blue-400">
                      {initials || "T"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                    {displayName}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-300">
                      Trainer
                    </span>
                    {profile?.specialization && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/15 text-purple-300">
                        {profile.specialization}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        isActive
                          ? "bg-green-500/15 text-green-300"
                          : "bg-gray-600/40 text-gray-300"
                      }`}
                    >
                      {isActive ? "Active" : "Deactivated"}
                    </span>
                  </div>
                </div>
              </div>

              {!isEditing && (
                <button
                  onClick={startEditing}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition active:scale-95 flex-shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  Edit profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inline status messages */}
        {saved && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-300 text-sm">
            <Check className="w-4 h-4 flex-shrink-0" />
            Profile updated.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
            <X className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* What this trainer is responsible for */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon={Users} value={stats.members} label="Members trained" />
          <Stat icon={CalendarDays} value={stats.classes} label="Classes" />
          <Stat
            icon={Briefcase}
            value={profile?.experience || "—"}
            label="Experience"
          />
        </div>

        {isEditing ? (
          <form
            onSubmit={handleSave}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-5 sm:p-6 space-y-6"
          >
            <div>
              <h2 className="text-sm font-bold text-white mb-4">
                Contact details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="profile-name">
                    Full name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={form.name}
                    onChange={setField("name")}
                    className={inputClass}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-phone">
                    Phone
                  </label>
                  <input
                    id="profile-phone"
                    type="tel"
                    value={form.phone}
                    onChange={setField("phone")}
                    className={inputClass}
                    placeholder="07X XXX XXXX"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="profile-email">
                    Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={form.email}
                    onChange={setField("email")}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <h2 className="text-sm font-bold text-white mb-4">
                Professional details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="profile-spec">
                    Specialization
                  </label>
                  <input
                    id="profile-spec"
                    type="text"
                    value={form.specialization}
                    onChange={setField("specialization")}
                    className={inputClass}
                    placeholder="Strength & conditioning"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-exp">
                    Experience
                  </label>
                  <input
                    id="profile-exp"
                    type="text"
                    value={form.experience}
                    onChange={setField("experience")}
                    className={inputClass}
                    placeholder="5 years"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="profile-cert">
                    Certifications
                  </label>
                  <input
                    id="profile-cert"
                    type="text"
                    value={form.certification}
                    onChange={setField("certification")}
                    className={inputClass}
                    placeholder="NASM CPT, CrossFit L1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="profile-bio">
                    About
                  </label>
                  <textarea
                    id="profile-bio"
                    rows={4}
                    value={form.bio}
                    onChange={setField("bio")}
                    className={`${inputClass} resize-y`}
                    placeholder="A short introduction members will see."
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-gray-700 pt-5">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 sm:p-6">
                <h2 className="text-sm font-bold text-white mb-5">
                  Contact details
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field icon={User} label="Full name" value={profile?.name} />
                  <Field icon={Phone} label="Phone" value={profile?.phone} />
                  <Field icon={Mail} label="Email" value={profile?.email} />
                </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 sm:p-6">
                <h2 className="text-sm font-bold text-white mb-5">
                  Professional details
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field
                    icon={Briefcase}
                    label="Specialization"
                    value={profile?.specialization}
                  />
                  <Field
                    icon={Award}
                    label="Experience"
                    value={profile?.experience}
                  />
                  <div className="sm:col-span-2">
                    <Field
                      icon={ShieldCheck}
                      label="Certifications"
                      value={profile?.certification}
                    />
                  </div>
                </div>
                <div className="mt-5 pt-5 border-t border-gray-700">
                  <div className={labelClass}>About</div>
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-line ${
                      profile?.bio ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {profile?.bio ||
                      "No introduction yet. Add one so members know who they are training with."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 sm:p-6">
                <h2 className="text-sm font-bold text-white mb-5">Account</h2>
                <div className="space-y-5">
                  <Field
                    icon={User}
                    label="Username"
                    value={profile?.username}
                  />
                  <Field
                    icon={Building2}
                    label="Gym ID"
                    value={currentUser?.gymId}
                    mono
                  />
                  <Field
                    icon={CalendarDays}
                    label="Member since"
                    value={
                      joined && !isNaN(joined.getTime())
                        ? joined.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""
                    }
                  />
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 text-xs text-gray-400 leading-relaxed">
                Your username, role and password are managed by your gym admin.
                Ask them if any of these need to change.
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InstructorProfile;
