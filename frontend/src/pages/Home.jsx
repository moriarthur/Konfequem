import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { error as logError } from "../utils/logger";
import BookingList from "../components/BookingList";
import RoomList from "../components/RoomList";
import Button from "../components/ui/Button";
import { Heading, Text } from "../components/ui/Typography";

export default function Home() {
    const { authFetch, logout, isAuthenticated, loading, user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [colorMode, setColorMode] = useState("Light");
    const [language, setLanguage] = useState("ENG");

    useEffect(() => {
        if (!isAuthenticated) {
            setRooms([]);
            setBookings([]);
            return;
        }

        const fetchData = async () => {
            try {
                const roomsData = await authFetch("/api/rooms/");
                setRooms(roomsData);
                const bookingsData = await authFetch("/api/bookings/");
                setBookings(bookingsData);
                } catch (err) {
                logError("Error fetching data:", err);
            }
        };

        fetchData();
    }, [authFetch, isAuthenticated]);

    // Called when a new booking is created
    const handleBookingCreated = async () => {
        try {
            // Fetch fresh bookings data to ensure we have room names and all fields
            const bookingsData = await authFetch("/api/bookings/");
            setBookings(bookingsData);
        } catch (err) {
            logError("Error refreshing bookings:", err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 px-6 py-12 relative">
            {loading && <div className="text-center mt-20"><Text variant="default">Loading...</Text></div>}

            {!loading && (
                <>
                    <div className="flex justify-center items-center gap-3 mb-4">
                        <span className="text-xs uppercase tracking-[0.3em] text-gray-500 select-none cursor-default">Konfequem</span>
                        <Link to="/" className="flex-shrink-0">
                            <img
                                src="/konfequem_logo.svg"
                                alt="Konfequem logo"
                                className="w-10 h-10 select-none"
                            />
                        </Link>
                        <span className="text-xs uppercase tracking-[0.3em] text-gray-500 select-none cursor-default">Workspace</span>
                    </div>

                    <header className="bg-white rounded-2xl shadow-sm px-6 py-6 mb-10">
                        <div className="relative flex items-center justify-between gap-4">
                            <div className="relative flex items-center gap-3">
                                <button
                                    type="button"
                                    aria-label="Open menu"
                                    aria-expanded={isMenuOpen}
                                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-600/30 ${
                                        isMenuOpen
                                            ? 'border-gray-900 bg-white text-gray-900 shadow-sm'
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                    onClick={() => setIsMenuOpen((prev) => !prev)}
                                >
                                    <span className="flex flex-col gap-1.5">
                                        <span className="block h-0.5 w-5 rounded-full bg-current" />
                                        <span className="block h-0.5 w-4 rounded-full bg-current" />
                                        <span className="block h-0.5 w-5 rounded-full bg-current" />
                                    </span>
                                </button>

                                <div
                                    className={`hidden md:flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out ${
                                        isMenuOpen ? 'max-w-[220px] opacity-100 translate-x-0' : 'max-w-0 opacity-0 translate-x-4 pointer-events-none'
                                    }`}
                                    aria-hidden={!isMenuOpen}
                                >
                                    <span className="sr-only">Color mode</span>
                                    {['Light', 'Dark'].map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setColorMode(mode)}
                                            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition whitespace-nowrap ${
                                                colorMode === mode
                                                    ? 'border-gray-900 bg-gray-900 text-white'
                                                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                            }`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
                                <Heading level={1} className="mb-1">
                                    {user?.first_name || user?.username}
                                </Heading>
                            </div>

                            <div className="relative hidden md:flex items-center justify-end gap-4">
                                <div
                                    className={`flex items-center gap-2 overflow-hidden text-sm font-semibold transition-all duration-300 ease-out ${
                                        isMenuOpen ? 'max-w-[160px] opacity-100 translate-x-0' : 'max-w-0 opacity-0 translate-x-4 pointer-events-none'
                                    }`}
                                    aria-hidden={!isMenuOpen}
                                >
                                    {['ENG', 'DE'].map((lang) => (
                                        <button
                                            key={lang}
                                            type="button"
                                            onClick={() => setLanguage(lang)}
                                            className={`rounded-lg border px-3 py-2 transition ${
                                                language === lang
                                                    ? 'border-gray-900 bg-gray-900 text-white'
                                                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                            }`}
                                        >
                                            {lang}
                                        </button>
                                    ))}
                                </div>

                                {isAuthenticated && (
                                    <Button variant="danger" onClick={logout}>
                                        Logout
                                    </Button>
                                )}
                            </div>
                        </div>
                    </header>

                    <div
                        className={`fixed inset-0 z-40 bg-white px-6 py-8 transition-all duration-300 ease-out md:hidden ${
                            isMenuOpen ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-4'
                        }`}
                        role="dialog"
                        aria-modal="true"
                        aria-hidden={!isMenuOpen}
                    >
                        <div className="flex h-full flex-col">
                            <div className="flex items-center justify-between">
                                <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Menu</span>
                                <button
                                    type="button"
                                    aria-label="Close menu"
                                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-600/30"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <span className="absolute inset-0 flex items-center justify-center text-xl leading-[1] -translate-y-[2px]">×</span>
                                </button>
                            </div>

                            <div className="mt-10 space-y-8">
                                <div>
                                    <Text variant="muted" className="mb-3 text-xs uppercase tracking-[0.2em]">Color mode</Text>
                                    <div className="flex items-center gap-3">
                                        {['Light', 'Dark'].map((mode) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => setColorMode(mode)}
                                                className={`flex-1 rounded-2xl border px-4 py-3 text-base font-semibold transition ${
                                                    colorMode === mode
                                                        ? 'border-gray-900 bg-gray-900 text-white'
                                                        : 'border-gray-200 text-gray-800 hover:border-gray-300'
                                                }`}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Text variant="muted" className="mb-3 text-xs uppercase tracking-[0.2em]">Language</Text>
                                    <div className="flex items-center gap-3 text-base font-semibold">
                                        {['ENG', 'DE'].map((lang) => (
                                            <button
                                                key={lang}
                                                type="button"
                                                onClick={() => setLanguage(lang)}
                                                className={`flex-1 rounded-2xl border px-4 py-3 transition ${
                                                    language === lang
                                                        ? 'border-gray-900 bg-gray-900 text-white'
                                                        : 'border-gray-200 text-gray-800 hover:border-gray-300'
                                                }`}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-8">
                                {isAuthenticated && (
                                    <Button variant="danger" className="w-full" onClick={logout}>
                                        Logout
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {isAuthenticated ? (
                        <>
                            <section className="mb-12">
                                <Heading level={2} className="mb-6">
                                    Available Rooms
                                </Heading>
                                <RoomList rooms={rooms} onBook={handleBookingCreated} />
                            </section>

                            <section>
                                <Heading level={2} className="mb-6">
                                    Your Bookings
                                </Heading>
                                {bookings.length > 0 ? (
                                    <BookingList bookings={bookings} authFetch={authFetch} onRefresh={handleBookingCreated} />
                                ) : (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                                        <Text variant="muted">No bookings found.</Text>
                                    </div>
                                )}
                            </section>
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <Text variant="large">Please log in to see rooms and bookings.</Text>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
