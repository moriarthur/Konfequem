import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { error as logError } from "../utils/logger";
import { OFFICE_TIMEZONE, BookingData } from "../utils/bookingUtils";
import { useAlert } from "../context/AlertContext";
import { FiEye, FiEyeOff } from "react-icons/fi";
import BottomNav from "../components/BottomNav";
import Button from "../components/ui/Button";
import Logo from "../components/Logo";
import { Heading, Text } from "../components/ui/Typography";
import { StatCardSkeleton } from "../components/ui/Skeleton";
import { DateTime } from "luxon";
import { PaginatedResponse, Room } from "../types";

interface UserStats {
  totalBookings: number;
  currentBookings: number;
  upcomingBookings: number;
  totalRooms: number;
}

interface PasswordForm {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
}

export default function ProfilePage() {
  const { user, authFetch, logout, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats>({
    totalBookings: 0,
    currentBookings: 0,
    upcomingBookings: 0,
    totalRooms: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({ old_password: "", new_password: "", confirm_password: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>({ first_name: "", last_name: "", email: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [members, setMembers] = useState<Array<{ id: number; username: string; email: string; role: string; first_name: string; last_name: string }>>([]);
  const [inviteKey, setInviteKey] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const pw = passwordForm.new_password;
  const pwChecks: { met: boolean; label: string }[] = [
    { met: pw.length >= 8, label: "At least 8 characters" },
    { met: /[A-Z]/.test(pw) && /[a-z]/.test(pw), label: "Uppercase and lowercase letters" },
    { met: /[0-9]/.test(pw), label: "At least one number" },
    { met: !/^\d+$/.test(pw), label: "Not entirely numeric" },
  ];
  const getPasswordStrength = (password: string): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const levels = [
      { level: 1, label: "Weak", color: "bg-status-danger" },
      { level: 2, label: "Fair", color: "bg-status-warning" },
      { level: 3, label: "Good", color: "bg-yellow-400" },
      { level: 4, label: "Strong", color: "bg-status-success" },
    ];
    return levels[score - 1] || { level: 0, label: "", color: "" };
  };

  const strength = getPasswordStrength(passwordForm.new_password);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [bookingsData, roomsData] = await Promise.all([
          authFetch("/api/bookings/"),
          authFetch("/api/rooms/"),
        ]);

        const bookingsResp = bookingsData as PaginatedResponse<BookingData>;
        const roomsResp = roomsData as PaginatedResponse<Room>;
        const bookings = bookingsResp.results || [];
        const rooms = roomsResp.results || [];

        const now = DateTime.now().setZone(OFFICE_TIMEZONE);
        const current = bookings.filter(
          (b) => { const s = DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE); const e = DateTime.fromISO(b.end_time).setZone(OFFICE_TIMEZONE); return now >= s && now < e; }
        ).length;
        const upcoming = bookings.filter(
          (b) => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) > now
        ).length;

        setStats({
          totalBookings: bookingsResp.count || bookings.length,
          currentBookings: current,
          upcomingBookings: upcoming,
          totalRooms: roomsResp.count || rooms.length,
        });
      } catch (err) {
        logError("Error fetching profile data:", err);
        // 429 already surfaces a toast from authFetch; keep loaded data
        if ((err as { status?: number }).status !== 429) {
          showAlert("Could not load profile data. Please try again.", { type: "error" });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authFetch, isAuthenticated]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate("/login");
    } catch (err) {
      logError("Error during logout:", err);
      setLoggingOut(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      setPasswordError("All fields are required.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (passwordForm.old_password === passwordForm.new_password) {
      setPasswordError("New password must be different from current password.");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    try {
      setPasswordSaving(true);
      const response = await authFetch("/api/users/change-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      if (response) {
        showAlert("Password changed successfully", { type: "success" });
        setShowPasswordModal(false);
        setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string; error?: string };
      const msg = e?.message || e?.error || "Failed to change password.";
      setPasswordError(typeof msg === "string" ? msg : "Failed to change password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const firstName = user?.first_name as string | undefined;
  const lastName = user?.last_name as string | undefined;
  const username = user?.username as string | undefined;
  const email = user?.email as string | undefined;
  const role = user?.role as string | undefined;
  const org = user?.organization as { id: number; name: string; slug: string } | null | undefined;

  useEffect(() => {
    if (role !== "org_admin") return;
    authFetch("/api/org/members/")
      .then((data) => setMembers(data as typeof members))
      .catch(() => {});
  }, [role, authFetch]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const data = await authFetch("/api/org/invite/regenerate/", { method: "POST" }) as { invite_key: string };
      setInviteKey(data.invite_key);
      showAlert("Invite link regenerated", { type: "success" });
    } catch {
      showAlert("Failed to regenerate invite", { type: "error" });
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyInvite = () => {
    const key = inviteKey || "";
    const url = `${window.location.origin}/join/${key}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
        <Text variant="muted" className="text-center">
          Please log in to view your profile.
        </Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted pb-20">
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Heading level={1} className="text-2xl font-semibold text-accent-secondary">
            Profile
          </Heading>
          <Text variant="muted" className="mt-1">
            Manage your account and preferences
          </Text>
        </div>

        <div className="bg-surface-base border border-border-subtle rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <Logo size="md" />
            <div className="flex-1">
              <Heading level={2} className="text-lg font-semibold text-accent-secondary">
                {firstName && lastName
                  ? `${firstName} ${lastName}`
                  : username || "User"}
              </Heading>
              <Text variant="muted" className="text-sm">
                @{username || "user"}
              </Text>
            </div>
            <button
              onClick={() => {
                if (editMode) {
                  setEditMode(false);
                  setProfileError("");
                } else {
                  setProfileForm({
                    first_name: firstName || "",
                    last_name: lastName || "",
                    email: email || "",
                  });
                  setEditMode(true);
                }
              }}
              className="text-sm text-accent-primary hover:underline"
            >
              {editMode ? "Cancel" : "Edit"}
            </button>
          </div>

          {profileError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <Text className="text-sm text-red-600">{profileError}</Text>
            </div>
          )}

          {editMode ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-accent-secondary mb-1">First name</label>
                  <input
                    type="text"
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-surface-base text-accent-secondary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-accent-secondary mb-1">Last name</label>
                  <input
                    type="text"
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-surface-base text-accent-secondary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-accent-secondary mb-1">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-surface-base text-accent-secondary"
                />
              </div>
              <button
                onClick={async () => {
                  setProfileError("");
                  setProfileSaving(true);
                  try {
                    await authFetch("/api/users/me/", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(profileForm),
                    });
                    showAlert("Profile updated", { type: "success" });
                    setEditMode(false);
                  } catch (err: unknown) {
                    const e = err as { message?: string; error?: string };
                    const msg = e?.message || e?.error || "Failed to update profile.";
                    setProfileError(typeof msg === "string" ? msg : "Failed to update profile.");
                  } finally {
                    setProfileSaving(false);
                  }
                }}
                disabled={profileSaving}
                className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {profileSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-accent-secondary/60">
                  <path d="M21 8L17.4392 9.97822C15.454 11.0811 14.4614 11.6326 13.4102 11.8488C12.4798 12.0401 11.5202 12.0401 10.5898 11.8488C9.53864 11.6326 8.54603 11.0811 6.5608 9.97822L3 8M6.2 19H17.8C18.9201 19 19.4802 19 19.908 18.782C20.2843 18.5903 20.5903 18.2843 20.782 17.908C21 17.4802 21 16.9201 21 15.8V8.2C21 7.0799 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V15.8C3 16.9201 3 17.4802 3.21799 17.908C3.40973 18.2843 3.71569 18.5903 4.09202 18.782C4.51984 19 5.07989 19 6.2 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <Text variant="muted">{email || "No email set"}</Text>
              </div>
            </div>
          )}
        </div>

        {org && (
          <div className="bg-surface-base border border-border-subtle rounded-xl p-6 mb-6">
            <Heading level={3} className="text-sm font-semibold text-accent-secondary mb-3">
              Organization
            </Heading>
            <div className="flex items-center gap-2 mb-2">
              <Text className="text-base font-medium text-accent-secondary">{org.name}</Text>
              <Text variant="muted" className="text-sm">/{org.slug}</Text>
            </div>

            {role === "org_admin" && (
              <div className="mt-4 space-y-4">
                <div>
                  <Text variant="muted" className="text-xs mb-1">Invite link</Text>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-surface-muted border border-border-subtle rounded-lg text-sm text-accent-secondary truncate">
                      {window.location.origin}/join/{inviteKey || "••••••••"}
                    </code>
                    <button onClick={handleCopyInvite} className="px-3 py-2 border border-border-subtle rounded-lg text-sm text-accent-secondary hover:bg-surface-muted transition">
                      {copiedInvite ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={handleRegenerate} disabled={regenerating} className="px-3 py-2 border border-border-subtle rounded-lg text-sm text-accent-secondary hover:bg-surface-muted transition disabled:opacity-50">
                      {regenerating ? "..." : "Regenerate"}
                    </button>
                  </div>
                </div>

                <div>
                  <Text variant="muted" className="text-xs mb-2">Members ({members.length})</Text>
                  <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
                    {members.map((m) => (
                      <div key={m.id} className="px-3 py-2 flex items-center justify-between bg-surface-base">
                        <div>
                          <Text className="text-sm font-medium text-accent-secondary">{m.username}</Text>
                          {m.first_name && <Text variant="muted" className="text-xs ml-2">{m.first_name} {m.last_name}</Text>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === "org_admin" ? "bg-accent-primary/10 text-accent-primary" : "bg-surface-muted text-accent-secondary/60"}`}>
                          {m.role === "org_admin" ? "Admin" : "Member"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-surface-base border border-border-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-accent-secondary">
                {stats.totalBookings}
              </p>
              <p className="text-xs text-accent-secondary/60 mt-1">Total bookings</p>
            </div>
            <div className="bg-surface-base border border-border-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-status-success">
                {stats.currentBookings}
              </p>
              <p className="text-xs text-accent-secondary/60 mt-1">Current</p>
            </div>
            <div className="bg-surface-base border border-border-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-accent-secondary">
                {stats.upcomingBookings}
              </p>
              <p className="text-xs text-accent-secondary/60 mt-1">Upcoming</p>
            </div>
          </div>
        )}

        <div className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border-subtle">
            <Heading level={3} className="text-sm font-semibold text-accent-secondary">
              Settings
            </Heading>
          </div>

          <div className="divide-y divide-border-subtle">
            <button
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-muted transition-colors"
              onClick={() => { setPasswordError(""); setShowPasswordModal(true); }}
            >
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary/60">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 8.25C9.92894 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92894 15.75 12 15.75C14.0711 15.75 15.75 14.0711 15.75 12C15.75 9.92893 14.0711 8.25 12 8.25ZM9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z" fill="currentColor"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M11.9747 1.25C11.5303 1.24999 11.1592 1.24999 10.8546 1.27077C10.5375 1.29241 10.238 1.33905 9.94761 1.45933C9.27379 1.73844 8.73843 2.27379 8.45932 2.94762C8.31402 3.29842 8.27467 3.66812 8.25964 4.06996C8.24756 4.39299 8.08454 4.66251 7.84395 4.80141C7.60337 4.94031 7.28845 4.94673 7.00266 4.79568C6.64714 4.60777 6.30729 4.45699 5.93083 4.40743C5.20773 4.31223 4.47642 4.50819 3.89779 4.95219C3.64843 5.14353 3.45827 5.3796 3.28099 5.6434C3.11068 5.89681 2.92517 6.21815 2.70294 6.60307L2.67769 6.64681C2.45545 7.03172 2.26993 7.35304 2.13562 7.62723C1.99581 7.91267 1.88644 8.19539 1.84541 8.50701C1.75021 9.23012 1.94617 9.96142 2.39016 10.5401C2.62128 10.8412 2.92173 11.0602 3.26217 11.2741C3.53595 11.4461 3.68788 11.7221 3.68786 12C3.68785 12.2778 3.53592 12.5538 3.26217 12.7258C2.92169 12.9397 2.62121 13.1587 2.39007 13.4599C1.94607 14.0385 1.75012 14.7698 1.84531 15.4929C1.88634 15.8045 1.99571 16.0873 2.13552 16.3727C2.26983 16.6469 2.45535 16.9682 2.67758 17.3531L2.70284 17.3969C2.92507 17.7818 3.11058 18.1031 3.28089 18.3565C3.45817 18.6203 3.64833 18.8564 3.89769 19.0477C4.47632 19.4917 5.20763 19.6877 5.93073 19.5925C6.30717 19.5429 6.647 19.3922 7.0025 19.2043C7.28833 19.0532 7.60329 19.0596 7.8439 19.1986C8.08452 19.3375 8.24756 19.607 8.25964 19.9301C8.27467 20.3319 8.31403 20.7016 8.45932 21.0524C8.73843 21.7262 9.27379 22.2616 9.94761 22.5407C10.238 22.661 10.5375 22.7076 10.8546 22.7292C11.1592 22.75 11.5303 22.75 11.9747 22.75H12.0252C12.4697 22.75 12.8407 22.75 13.1454 22.7292C13.4625 22.7076 13.762 22.661 14.0524 22.5407C14.7262 22.2616 15.2616 21.7262 15.5407 21.0524C15.686 20.7016 15.7253 20.3319 15.7403 19.93C15.7524 19.607 15.9154 19.3375 16.156 19.1985C16.3966 19.0596 16.7116 19.0532 16.9974 19.2042C17.3529 19.3921 17.6927 19.5429 18.0692 19.5924C18.7923 19.6876 19.5236 19.4917 20.1022 19.0477C20.3516 18.8563 20.5417 18.6203 20.719 18.3565C20.8893 18.1031 21.0748 17.7818 21.297 17.3969L21.3223 17.3531C21.5445 16.9682 21.7301 16.6468 21.8644 16.3726C22.0042 16.0872 22.1135 15.8045 22.1546 15.4929C22.2498 14.7697 22.0538 14.0384 21.6098 13.4598C21.3787 13.1586 21.0782 12.9397 20.7378 12.7258C20.464 12.5538 20.3121 12.2778 20.3121 11.9999C20.3121 11.7221 20.464 11.4462 20.7377 11.2742C21.0783 11.0603 21.3788 10.8414 21.6099 10.5401C22.0539 9.96149 22.2499 9.23019 22.1547 8.50708C22.1136 8.19546 22.0043 7.91274 21.8645 7.6273C21.7302 7.35313 21.5447 7.03183 21.3224 6.64695L21.2972 6.60318C21.0749 6.21825 20.8894 5.89688 20.7191 5.64347C20.5418 5.37967 20.3517 5.1436 20.1023 4.95225C19.5237 4.50826 18.7924 4.3123 18.0692 4.4075C17.6928 4.45706 17.353 4.60782 16.9975 4.79572C16.7117 4.94679 16.3967 4.94036 16.1561 4.80144C15.9155 4.66253 15.7524 4.39297 15.7403 4.06991C15.7253 3.66808 15.686 3.2984 15.5407 2.94762C15.2616 2.27379 14.7262 1.73844 14.0524 1.45933C13.762 1.33905 13.4625 1.29241 13.1454 1.27077C12.8407 1.24999 12.4697 1.24999 12.0252 1.25H11.9747ZM10.5216 2.84515C10.5988 2.81319 10.716 2.78372 10.9567 2.76729C11.2042 2.75041 11.5238 2.75 12 2.75C12.4762 2.75 12.7958 2.75041 13.0432 2.76729C13.284 2.78372 13.4012 2.81319 13.4783 2.84515C13.7846 2.97202 14.028 3.21536 14.1548 3.52165C14.1949 3.61826 14.228 3.76887 14.2414 4.12597C14.271 4.91835 14.68 5.68129 15.4061 6.10048C16.1321 6.51968 16.9974 6.4924 17.6984 6.12188C18.0143 5.9549 18.1614 5.90832 18.265 5.89467C18.5937 5.8514 18.9261 5.94047 19.1891 6.14228C19.2554 6.19312 19.3395 6.27989 19.4741 6.48016C19.6125 6.68603 19.7726 6.9626 20.0107 7.375C20.2488 7.78741 20.4083 8.06438 20.5174 8.28713C20.6235 8.50382 20.6566 8.62007 20.6675 8.70287C20.7108 9.03155 20.6217 9.36397 20.4199 9.62698C20.3562 9.70995 20.2424 9.81399 19.9397 10.0041C19.2684 10.426 18.8122 11.1616 18.8121 11.9999C18.8121 12.8383 19.2683 13.574 19.9397 13.9959C20.2423 14.186 20.3561 14.29 20.4198 14.373C20.6216 14.636 20.7107 14.9684 20.6674 15.2971C20.6565 15.3799 20.6234 15.4961 20.5173 15.7128C20.4082 15.9355 20.2487 16.2125 20.0106 16.6249C19.7725 17.0373 19.6124 17.3139 19.474 17.5198C19.3394 17.72 19.2553 17.8068 19.189 17.8576C18.926 18.0595 18.5936 18.1485 18.2649 18.1053C18.1613 18.0916 18.0142 18.045 17.6983 17.8781C16.9973 17.5075 16.132 17.4803 15.4059 17.8995C14.68 18.3187 14.271 19.0816 14.2414 19.874C14.228 20.2311 14.1949 20.3817 14.1548 20.4784C14.028 20.7846 13.7846 21.028 13.4783 21.1549C13.4012 21.1868 13.284 21.2163 13.0432 21.2327C12.7958 21.2496 12.4762 21.25 12 21.25C11.5238 21.25 11.2042 21.2496 10.9567 21.2327C10.716 21.2163 10.5988 21.1868 10.5216 21.1549C10.2154 21.028 9.97201 20.7846 9.84514 20.4784C9.80512 20.3817 9.77195 20.2311 9.75859 19.874C9.72896 19.0817 9.31997 18.3187 8.5939 17.8995C7.86784 17.4803 7.00262 17.5076 6.30158 17.8781C5.98565 18.0451 5.83863 18.0917 5.73495 18.1053C5.40626 18.1486 5.07385 18.0595 4.81084 17.8577C4.74458 17.8069 4.66045 17.7201 4.52586 17.5198C4.38751 17.314 4.22736 17.0374 3.98926 16.625C3.75115 16.2126 3.59171 15.9356 3.4826 15.7129C3.37646 15.4962 3.34338 15.3799 3.33248 15.2971C3.28921 14.9684 3.37828 14.636 3.5801 14.373C3.64376 14.2901 3.75761 14.186 4.0602 13.9959C4.73158 13.5741 5.18782 12.8384 5.18786 12.0001C5.18791 11.1616 4.73165 10.4259 4.06021 10.004C3.75769 9.81389 3.64385 9.70987 3.58019 9.62691C3.37838 9.3639 3.28931 9.03149 3.33258 8.7028C3.34348 8.62001 3.37656 8.50375 3.4827 8.28707C3.59181 8.06431 3.75125 7.78734 3.98935 7.37493C4.22746 6.96253 4.3876 6.68596 4.52596 6.48009C4.66055 6.27983 4.74468 6.19305 4.81093 6.14222C5.07395 5.9404 5.40636 5.85133 5.73504 5.8946C5.83873 5.90825 5.98576 5.95483 6.30173 6.12184C7.00273 6.49235 7.86791 6.51962 8.59394 6.10045C9.31998 5.68128 9.72896 4.91837 9.75859 4.12602C9.77195 3.76889 9.80512 3.61827 9.84514 3.52165C9.97201 3.21536 10.2154 2.97202 10.5216 2.84515Z" fill="currentColor"/>
                </svg>
                <span className="text-sm text-accent-secondary">Change password</span>
              </div>
              <svg className="w-5 h-5 text-accent-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <Button
          variant="danger"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center bg-status-danger hover:bg-status-danger/90"
          size="lg"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" style={{ transform: 'scaleX(-1)' }}>
            <path d="M14.9453 1.25C13.5778 1.24998 12.4754 1.24996 11.6085 1.36652C10.7084 1.48754 9.95048 1.74643 9.34857 2.34835C8.82363 2.87328 8.55839 3.51836 8.41916 4.27635C8.28387 5.01291 8.25799 5.9143 8.25196 6.99583C8.24966 7.41003 8.58357 7.74768 8.99778 7.74999C9.41199 7.7523 9.74964 7.41838 9.75194 7.00418C9.75803 5.91068 9.78643 5.1356 9.89448 4.54735C9.99859 3.98054 10.1658 3.65246 10.4092 3.40901C10.686 3.13225 11.0746 2.9518 11.8083 2.85315C12.5637 2.75159 13.5648 2.75 15.0002 2.75H16.0002C17.4356 2.75 18.4367 2.75159 19.1921 2.85315C19.9259 2.9518 20.3144 3.13225 20.5912 3.40901C20.868 3.68577 21.0484 4.07435 21.1471 4.80812C21.2486 5.56347 21.2502 6.56459 21.2502 8V16C21.2502 17.4354 21.2486 18.4365 21.1471 19.1919C21.0484 19.9257 20.868 20.3142 20.5912 20.591C20.3144 20.8678 19.9259 21.0482 19.1921 21.1469C18.4367 21.2484 17.4356 21.25 16.0002 21.25H15.0002C13.5648 21.25 12.5637 21.2484 11.8083 21.1469C11.0746 21.0482 10.686 20.8678 10.4092 20.591C10.1658 20.3475 9.99859 20.0195 9.89448 19.4527C9.78643 18.8644 9.75803 18.0893 9.75194 16.9958C9.74964 16.5816 9.41199 16.2477 8.99778 16.25C8.58357 16.2523 8.24966 16.59 8.25196 17.0042C8.25799 18.0857 8.28387 18.9871 8.41916 19.7236C8.55839 20.4816 8.82363 21.1267 9.34857 21.6517C9.95048 22.2536 10.7084 22.5125 11.6085 22.6335C12.4754 22.75 13.5778 22.75 14.9453 22.75H16.0551C17.4227 22.75 18.525 22.75 19.392 22.6335C20.2921 22.5125 21.0499 22.2536 21.6519 21.6517C22.2538 21.0497 22.5127 20.2919 22.6337 19.3918C22.7503 18.5248 22.7502 17.4225 22.7502 16.0549V7.94513C22.7502 6.57754 22.7503 5.47522 22.6337 4.60825C22.5127 3.70814 22.2538 2.95027 21.6519 2.34835C21.0499 1.74643 20.2921 1.48754 19.392 1.36652C18.525 1.24996 17.4227 1.24998 16.0551 1.25H14.9453Z" fill="currentColor"/>
            <path d="M15 11.25C15.4142 11.25 15.75 11.5858 15.75 12C15.75 12.4142 15.4142 12.75 15 12.75H4.02744L5.98809 14.4306C6.30259 14.7001 6.33901 15.1736 6.06944 15.4881C5.79988 15.8026 5.3264 15.839 5.01191 15.5694L1.51191 12.5694C1.34567 12.427 1.25 12.2189 1.25 12C1.25 11.7811 1.34567 11.573 1.51191 11.4306L5.01191 8.43056C5.3264 8.16099 5.79988 8.19741 6.06944 8.51191C6.33901 8.8264 6.30259 9.29988 5.98809 9.56944L4.02744 11.25H15Z" fill="currentColor"/>
          </svg>
          <span className="ml-2">{loggingOut ? "Logging out..." : "Log out"}</span>
        </Button>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface-base rounded-xl p-6 max-w-sm w-full">
            <Heading level={3} className="text-lg font-semibold text-accent-secondary mb-4">Change password</Heading>

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <Text className="text-sm text-red-600">{passwordError}</Text>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-accent-secondary mb-1">Current password</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm(f => ({ ...f, old_password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-border-subtle rounded-lg bg-surface-base text-accent-secondary"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-accent-secondary/60 hover:text-accent-secondary" aria-label={showOldPassword ? "Hide" : "Show"}>
                    {showOldPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-accent-secondary mb-1">New password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-border-subtle rounded-lg bg-surface-base text-accent-secondary"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-accent-secondary/60 hover:text-accent-secondary" aria-label={showNewPassword ? "Hide" : "Show"}>
                    {showNewPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
                {passwordForm.new_password && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all ${
                            i <= strength.level ? strength.color : "bg-border-subtle"
                          }`}
                        />
                      ))}
                    </div>
                    <ul className="space-y-0.5">
                      {pwChecks.map((c) => (
                        <li key={c.label} className={`flex items-center gap-1.5 text-xs ${c.met ? "text-status-success" : "text-accent-secondary/50"}`}>
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 flex-shrink-0" fill="none">
                            {c.met ? (
                              <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            ) : (
                              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                            )}
                          </svg>
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-accent-secondary mb-1">Confirm new password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm(f => ({ ...f, confirm_password: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }}
                    className="w-full px-3 py-2 pr-10 border border-border-subtle rounded-lg bg-surface-base text-accent-secondary"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-accent-secondary/60 hover:text-accent-secondary" aria-label={showConfirmPassword ? "Hide" : "Show"}>
                    {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setShowPasswordModal(false); setPasswordForm({ old_password: "", new_password: "", confirm_password: "" }); setShowOldPassword(false); setShowNewPassword(false); setShowConfirmPassword(false); }}
                className="flex-1 px-4 py-2 border border-border-subtle rounded-lg hover:bg-surface-muted text-accent-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={passwordSaving}
                className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordSaving ? "Saving..." : "Change password"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
