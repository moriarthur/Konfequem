import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { error as logError } from "../utils/logger";
import BottomNav from "../components/BottomNav";
import Button from "../components/ui/Button";
import { Heading, Text } from "../components/ui/Typography";
import {
  UserIcon,
  EnvelopeIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

export default function ProfilePage() {
  const { user, authFetch, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    totalRooms: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

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

        const now = new Date();
        const upcoming = bookingsData.filter(
          (b) => new Date(b.start_time) >= now
        ).length;

        setStats({
          totalBookings: bookingsData.length,
          upcomingBookings: upcoming,
          totalRooms: roomsData.length,
        });
      } catch (err) {
        logError("Error fetching profile data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authFetch, isAuthenticated]);

  /**
   * Handle logout
   */
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
        {/* Header */}
        <div className="mb-6">
          <Heading level={1} className="text-2xl font-semibold text-accent-secondary">
            Profile
          </Heading>
          <Text variant="muted" className="mt-1">
            Manage your account and preferences
          </Text>
        </div>

        {/* User info card */}
        <div className="bg-surface-base border border-border-subtle rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-accent-primary/10 rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-accent-primary" />
            </div>
            <div className="flex-1">
              <Heading level={2} className="text-lg font-semibold text-accent-secondary">
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.username || "User"}
              </Heading>
              <Text variant="muted" className="text-sm">
                @{user?.username || "user"}
              </Text>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <EnvelopeIcon className="w-4 h-4 text-accent-secondary/60" />
              <Text variant="muted">{user?.email || "No email set"}</Text>
            </div>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-surface-base border border-border-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-accent-secondary">
                {stats.totalBookings}
              </p>
              <p className="text-xs text-accent-secondary/60 mt-1">Total bookings</p>
            </div>
            <div className="bg-surface-base border border-border-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-accent-secondary">
                {stats.upcomingBookings}
              </p>
              <p className="text-xs text-accent-secondary/60 mt-1">Upcoming</p>
            </div>
            <div className="bg-surface-base border border-border-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-accent-secondary">
                {stats.totalRooms}
              </p>
              <p className="text-xs text-accent-secondary/60 mt-1">Rooms</p>
            </div>
          </div>
        )}

        {/* Settings section */}
        <div className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border-subtle">
            <Heading level={3} className="text-sm font-semibold text-accent-secondary">
              Settings
            </Heading>
          </div>

          <div className="divide-y divide-border-subtle">
            <button
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-muted transition-colors"
              onClick={() => {/* Future: password change */}}
            >
              <div className="flex items-center gap-3">
                <CogIcon className="w-5 h-5 text-accent-secondary/60" />
                <span className="text-sm text-accent-secondary">Change password</span>
              </div>
              <svg
                className="w-5 h-5 text-accent-secondary/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            <button
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-muted transition-colors"
              onClick={() => {/* Future: notifications */}}
            >
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-accent-secondary/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <span className="text-sm text-accent-secondary">Notifications</span>
              </div>
              <svg
                className="w-5 h-5 text-accent-secondary/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Logout button */}
        <Button
          variant="danger"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center bg-status-danger hover:bg-status-danger/90"
          size="lg"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          <span className="ml-2">{loggingOut ? "Logging out..." : "Log out"}</span>
        </Button>

        {/* App info */}
        <div className="mt-8 text-center">
          <Text variant="small" className="text-accent-secondary/40">
            Konfequem v1.0.0
          </Text>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
