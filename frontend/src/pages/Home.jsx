import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { error as logError } from "../utils/logger";
import BookingList from "../components/BookingList";
import RoomList from "../components/RoomList";
import Button from "../components/ui/Button";
import { Heading, Text } from "../components/ui/Typography";

export default function Home() {
    const { authFetch, logout, isAuthenticated, loading, user } = useAuth();
    const { showAlert } = useAlert();
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [colorMode, setColorMode] = useState("Light");
    const [language, setLanguage] = useState("ENG");
    const menuPanelRef = useRef(null);

    const handleColorModeChange = (mode, { closeMenu = false } = {}) => {
        if (mode === colorMode) {
            if (closeMenu) {
                setTimeout(() => setIsMenuOpen(false), 150);
            }
            return;
        }

        setColorMode(mode);
        if (closeMenu) {
            showAlert(`Color mode switched to ${mode}`, { type: "success", duration: 2500 });
        }
        if (closeMenu) {
            setTimeout(() => setIsMenuOpen(false), 150);
        }
    };

    const handleLanguageChange = (lang, { closeMenu = false } = {}) => {
        if (lang === language) {
            if (closeMenu) {
                setTimeout(() => setIsMenuOpen(false), 150);
            }
            return;
        }

        setLanguage(lang);
        if (closeMenu) {
            showAlert(`Language switched to ${lang}`, { type: "success", duration: 2500 });
        }
        if (closeMenu) {
            setTimeout(() => setIsMenuOpen(false), 150);
        }
    };

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

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }

        const { body, documentElement } = document;
        const previousBodyOverflow = body.style.overflow;
        const previousDocOverflow = documentElement.style.overflow;

        if (isMenuOpen) {
            body.style.overflow = "hidden";
            documentElement.style.overflow = "hidden";
            requestAnimationFrame(() => {
                menuPanelRef.current?.focus();
            });
        } else {
            body.style.overflow = previousBodyOverflow;
            documentElement.style.overflow = previousDocOverflow;
        }

        return () => {
            body.style.overflow = previousBodyOverflow;
            documentElement.style.overflow = previousDocOverflow;
        };
    }, [isMenuOpen]);

    return (
        <div className="min-h-screen bg-surface-muted px-6 py-12 relative">
            {loading && <div className="text-center mt-20"><Text variant="default">Loading...</Text></div>}

            {!loading && (
                <>
                    <div className="flex justify-center items-center gap-3 mb-4">
                        <span className="text-xs uppercase tracking-[0.3em] text-accent-secondary/60 select-none cursor-default">Konfequem</span>
                        <Link to="/" className="flex-shrink-0">
                            <img
                                src="/konfequem_logo.svg"
                                alt="Konfequem logo"
                                className="w-10 h-10 select-none"
                            />
                        </Link>
                        <span className="text-xs uppercase tracking-[0.3em] text-accent-secondary/60 select-none cursor-default">Workspace</span>
                    </div>

                    <header className="bg-surface-base border border-border-subtle rounded-2xl shadow-soft px-6 py-6 mb-10 backdrop-blur">
                        <div className="relative flex items-center justify-between gap-4">
                            <div className="relative flex items-center gap-3">
                                <button
                                    type="button"
                                    aria-label="Open menu"
                                    aria-expanded={isMenuOpen}
                                    className={`group inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/30 hover:text-accent-secondary ${
                                        isMenuOpen
                                            ? 'border-border-subtle bg-surface-base text-accent-secondary shadow-soft'
                                            : 'border-border-subtle text-accent-secondary/70 hover:bg-surface-muted'
                                    }`}
                                    onClick={() => setIsMenuOpen((prev) => !prev)}
                                >
                                    <span
                                        className={`flex flex-col gap-1.5 text-accent-secondary/40 transition-all duration-200 group-hover:text-accent-secondary transform ${
                                            isMenuOpen ? 'rotate-90' : 'rotate-0'
                                        }`}
                                    >
                                        <span className="block h-0.5 w-5 rounded-full bg-current" />
                                        <span className="block h-0.5 w-5 rounded-full bg-current" />
                                        <span className="block h-0.5 w-5 rounded-full bg-current" />
                                    </span>
                                </button>

                                {isMenuOpen && (
                                    <div className="h-6 w-px bg-border-subtle transition-opacity duration-200" aria-hidden="true" />
                                )}

                                <div
                                    className={`hidden md:flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out transform origin-left ${
                                        isMenuOpen
                                            ? 'max-w-[220px] opacity-100 translate-x-0 scale-100'
                                            : 'max-w-0 opacity-0 -translate-x-4 pointer-events-none scale-95'
                                    }`}
                                    aria-hidden={!isMenuOpen}
                                >
                                    <span className="sr-only">Color mode</span>
                                    {['Light', 'Dark'].map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => handleColorModeChange(mode)}
                                            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition whitespace-nowrap ${
                                                colorMode === mode
                                                    ? 'border-border-subtle bg-surface-muted text-accent-secondary'
                                                    : 'border-border-subtle text-accent-secondary/70 hover:border-border-soft'
                                            }`}
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                {colorMode === mode && (
                                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-accent-secondary" aria-hidden="true" />
                                                )}
                                                {mode}
                                            </span>
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
                                            onClick={() => handleLanguageChange(lang)}
                                            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition whitespace-nowrap ${
                                                language === lang
                                                    ? 'border-border-subtle bg-surface-muted text-accent-secondary'
                                                    : 'border-border-subtle text-accent-secondary/70 hover:border-border-soft'
                                            }`}
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                {language === lang && (
                                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-accent-secondary" aria-hidden="true" />
                                                )}
                                                {lang}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {isAuthenticated && (
                                    <div className="flex items-center gap-4">
                                        {isMenuOpen && (
                                            <div className="h-6 w-px bg-border-subtle" aria-hidden="true" />
                                        )}
                                        <Button variant="danger" onClick={logout}>
                                            Logout
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    <div
                        className={`fixed inset-0 z-40 bg-surface-base px-6 py-8 transition-all duration-300 ease-out md:hidden ${
                            isMenuOpen ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-4'
                        }`}
                        role="dialog"
                        aria-modal="true"
                        aria-hidden={!isMenuOpen}
                    >
                        <div
                            ref={menuPanelRef}
                            tabIndex={-1}
                            className={`flex h-full flex-col overflow-hidden transition-[max-height,transform] duration-300 ease-out focus:outline-none transform ${
                                isMenuOpen ? 'max-h-full translate-y-0' : 'max-h-0 translate-y-6'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs uppercase tracking-[0.3em] text-accent-secondary/50">Menu</span>
                                <button
                                    type="button"
                                    aria-label="Close menu"
                                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle text-accent-secondary/70 transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-600/30"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <span className="absolute inset-0 flex items-center justify-center text-xl leading-[1] -translate-y-[2px]">×</span>
                                </button>
                            </div>

                            <div className="mt-10 flex-1 flex flex-col overflow-y-auto pr-1">
                                <div className="rounded-2xl border border-border-subtle/80 bg-surface-base/95 px-5 py-6 shadow-soft backdrop-blur-sm space-y-6">
                                    <div>
                                        <Text variant="muted" className="mb-3 text-xs uppercase tracking-[0.2em]">Color mode</Text>
                                        <div className="flex items-center gap-3">
                                            {['Light', 'Dark'].map((mode) => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => handleColorModeChange(mode, { closeMenu: true })}
                                                    className={`flex-1 rounded-2xl border px-4 py-3 text-base font-semibold transition ${
                                                        colorMode === mode
                                                            ? 'border-border-subtle bg-surface-muted text-accent-secondary'
                                                            : 'border-border-subtle text-accent-secondary/80 hover:border-border-soft'
                                                    }`}
                                                >
                                                    <span className="flex items-center justify-center gap-2">
                                                        {colorMode === mode && (
                                                            <span className="inline-flex h-2 w-2 rounded-full bg-accent-secondary" aria-hidden="true" />
                                                        )}
                                                        {mode}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="h-px bg-border-subtle" aria-hidden="true" />

                                    <div>
                                        <Text variant="muted" className="mb-3 text-xs uppercase tracking-[0.2em]">Language</Text>
                                        <div className="flex items-center gap-3 text-base font-semibold">
                                            {['ENG', 'DE'].map((lang) => (
                                                <button
                                                    key={lang}
                                                    type="button"
                                                    onClick={() => handleLanguageChange(lang, { closeMenu: true })}
                                                    className={`flex-1 rounded-2xl border px-4 py-3 transition ${
                                                        language === lang
                                                            ? 'border-border-subtle bg-surface-muted text-accent-secondary'
                                                            : 'border-border-subtle text-accent-secondary/80 hover:border-border-soft'
                                                    }`}
                                                >
                                                    <span className="flex items-center justify-center gap-2">
                                                        {language === lang && (
                                                            <span className="inline-flex h-2 w-2 rounded-full bg-accent-secondary" aria-hidden="true" />
                                                        )}
                                                        {lang}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {isAuthenticated && (
                                    <div className="mt-auto pt-8">
                                        <div className="h-px bg-border-subtle/70 mb-6" aria-hidden="true" />
                                        <div className="space-y-4">
                                            <Text variant="muted" className="text-xs uppercase tracking-[0.2em]">Account</Text>
                                            <Button variant="danger" className="w-full" onClick={logout}>
                                                Logout
                                            </Button>
                                        </div>
                                    </div>
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
                                    <div className="bg-surface-base border border-border-subtle rounded-2xl shadow-soft p-8 text-center">
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
