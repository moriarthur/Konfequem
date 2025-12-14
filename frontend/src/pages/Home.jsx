import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { error as logError } from "../utils/logger";
import BookingList from "../components/BookingList";
import RoomList from "../components/RoomList";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import Button from "../components/ui/Button";
import { Heading, Text } from "../components/ui/Typography";
import { DateTime } from "luxon";

export default function Home() {
    const { authFetch, logout, isAuthenticated, loading, user } = useAuth();
    const { showAlert } = useAlert();
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [colorMode, setColorMode] = useState("Light");
    const [language, setLanguage] = useState("ENG");
    const [showHelper, setShowHelper] = useState(() => {
        if (typeof window === "undefined") return true;
        const hasSeenHelper = localStorage.getItem('hasSeenMenuHelper');
        return !hasSeenHelper;
    });
    const menuPanelRef = useRef(null);
    const contentRef = useRef(null);
    const previouslyFocusedElementRef = useRef(null);
    const [isMobileViewport, setIsMobileViewport] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia("(max-width: 767px)").matches;
    });

    useEffect(() => {
        if (typeof window === "undefined") return;
        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const handleChange = (event) => setIsMobileViewport(event.matches);
        handleChange(mediaQuery);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    useEffect(() => {
        // Hide helper permanently after menu is opened for the first time
        if (isMenuOpen && showHelper) {
            localStorage.setItem('hasSeenMenuHelper', 'true');
            setShowHelper(false);
        }
    }, [isMenuOpen, showHelper]);

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

    /**
     * Refetch bookings after a new booking is created.
     * Ensures room names and all fields are up to date.
     */
    const handleBookingCreated = async () => {
        try {
            const bookingsData = await authFetch("/api/bookings/");
            setBookings(bookingsData);
        } catch (err) {
            logError("Error refreshing bookings:", err);
        }
    };

    const { upcomingCount, nextBooking } = useMemo(() => {
        if (!bookings || bookings.length === 0) {
            return { upcomingCount: 0, nextBooking: null };
        }

        const now = DateTime.now();
        const upcoming = bookings
            .filter((booking) => {
                if (!booking?.start_time) return false;
                const start = DateTime.fromISO(booking.start_time);
                return start >= now;
            })
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        return {
            upcomingCount: upcoming.length,
            nextBooking: upcoming[0] || null,
        };
    }, [bookings]);

    const stats = useMemo(() => {
        const totalRooms = rooms?.length || 0;
        const nextStart = nextBooking ? DateTime.fromISO(nextBooking.start_time).toFormat("dd MMM, HH:mm") : "No events";
        const nextRoom = nextBooking?.room_name || nextBooking?.room || "You're all caught up";
        return [
            {
                label: "Rooms",
                value: totalRooms,
                helper: totalRooms === 1 ? "available room" : "available rooms",
            },
            {
                label: "Upcoming bookings",
                value: upcomingCount,
                helper: upcomingCount ? "scheduled" : "Nothing scheduled",
            },
            {
                label: "Next event",
                value: nextStart,
                helper: nextBooking ? nextRoom : "Enjoy the quiet",
            },
        ];
    }, [rooms, upcomingCount, nextBooking]);

    const whatsNewItems = useMemo(
        () => [
            {
                title: "Grid view for bookings",
                description: "Preview overlaps faster with the new calendar-style overview.",
                date: "Nov 20",
            },
            {
                title: "Slack notifications",
                description: "Get channel alerts 10 minutes before your meeting starts.",
                date: "Nov 14",
            },
            {
                title: "Dark mode refresh",
                description: "We tuned the palette to improve contrast during late sessions.",
                date: "Nov 02",
            },
        ],
        []
    );

    useEffect(() => {
        const contentEl = contentRef.current;
        if (!contentEl) return;
        if (isMenuOpen && isMobileViewport) {
            contentEl.setAttribute("aria-hidden", "true");
            contentEl.setAttribute("inert", "");
        } else {
            contentEl.removeAttribute("aria-hidden");
            contentEl.removeAttribute("inert");
        }
    }, [isMenuOpen, isMobileViewport]);

    useEffect(() => {
        if (!isMenuOpen || !isMobileViewport || typeof document === "undefined") return;
        const panel = menuPanelRef.current;
        if (!panel) return;

        previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        const focusableSelectors = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(panel.querySelectorAll(focusableSelectors));
        const firstElement = focusableElements[0] || panel;
        const lastElement = focusableElements[focusableElements.length - 1] || panel;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setIsMenuOpen(false);
                return;
            }

            if (event.key === "Tab" && focusableElements.length > 0) {
                if (event.shiftKey) {
                    if (document.activeElement === firstElement) {
                        event.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        requestAnimationFrame(() => firstElement.focus());

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            const previouslyFocused = previouslyFocusedElementRef.current;
            if (previouslyFocused) {
                setTimeout(() => previouslyFocused.focus(), 0);
            }
        };
    }, [isMenuOpen]);

    return (
        <div className="min-h-screen bg-surface-muted px-6 py-12 relative">
            {loading && <div className="text-center mt-20"><Text variant="default">Loading...</Text></div>}

            {!loading && (
                <>
                    <div ref={contentRef} className="relative">
                        {/* Logo and helper - positioned to be above menu */}
                        <div className="relative flex flex-col items-center gap-4 z-20 mb-8">
                            {/* Helper text - only shown to new users */}
                            {showHelper && (
                                <div className={`transition-all duration-500 overflow-hidden ${
                                    isMenuOpen ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'
                                }`}>
                                    <Text variant="small" className="text-center text-accent-secondary/50">
                                        Manage theme, language, and account controls right from here.
                                    </Text>
                                </div>
                            )}

                            {/* Arrow - only shown to new users */}
                            {showHelper && (
                                <div className="flex justify-center">
                                    <span
                                        aria-hidden="true"
                                        className={`text-xs leading-none transition-all duration-200 inline-block animate-bounce-gentle ${
                                            isMenuOpen
                                                ? 'opacity-0'
                                                : 'text-accent-secondary/60 opacity-70'
                                        }`}
                                    >
                                        ▼
                                    </span>
                                </div>
                            )}

                            {/* Logo and workspace text */}
                            <div className="flex items-center gap-6">
                                <span className="text-sm uppercase tracking-[0.2em] text-accent-secondary/70 select-none cursor-default">Konfequem</span>
                                <div className="flex flex-col items-center gap-2">
                                    <div
                                        className={`relative rounded-full p-[3px] transition-all duration-300 ${
                                            isMenuOpen ? 'scale-105 opacity-100' : 'scale-90 opacity-80'
                                        }`}
                                        style={{
                                            background: 'linear-gradient(120deg, rgba(130,255,214,0.7), rgba(80,130,255,0.4))',
                                            boxShadow: isMenuOpen ? '0 0 18px rgba(99, 255, 214, 0.35)' : '0 0 10px rgba(99, 255, 214, 0.15)'
                                        }}
                                    >
                                        <button
                                            type="button"
                                            aria-label="Toggle workspace menu"
                                            aria-controls="workspace-menu-panel"
                                            aria-expanded={isMenuOpen}
                                            aria-pressed={isMenuOpen}
                                            className={`group relative flex h-20 w-20 items-center justify-center rounded-full border border-transparent bg-surface-base/80 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/30 ${
                                                isMenuOpen ? 'shadow-soft border-border-subtle/80' : 'hover:border-border-subtle/70 hover:bg-surface-base'
                                            }`}
                                            onClick={() => setIsMenuOpen((prev) => !prev)}
                                        >
                                            <span className="sr-only">{isMenuOpen ? 'Hide workspace controls' : 'Show workspace controls'}</span>
                                            <span
                                                className="relative flex h-12 w-12 items-center justify-center transition-transform duration-300 ease-out"
                                                style={{ transform: isMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                            >
                                                <img
                                                    src="/konfequem_logo.svg"
                                                    alt="Konfequem logo left half"
                                                    className="absolute h-full w-auto origin-center transition-transform duration-300 ease-out"
                                                    style={{
                                                        clipPath: 'polygon(0 0, 48% 0, 48% 100%, 0 100%)',
                                                        transform: `translateX(${isMenuOpen ? '-5px' : '-0.2px'})`
                                                    }}
                                                    aria-hidden="true"
                                                />
                                                <img
                                                    src="/konfequem_logo.svg"
                                                    alt="Konfequem logo right half"
                                                    className="absolute h-full w-auto origin-center transition-transform duration-300 ease-out"
                                                    style={{
                                                        clipPath: 'polygon(52% 0, 100% 0, 100% 100%, 52% 100%)',
                                                        transform: `translateX(${isMenuOpen ? '5px' : '0.2px'})`
                                                    }}
                                                    aria-hidden="true"
                                                />
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                <span className="text-sm uppercase tracking-[0.2em] text-accent-secondary/70 select-none cursor-default">Workspace</span>
                            </div>
                        </div>

                        {/* Menu - positioned to appear from under the logo */}
                        <div className="hidden md:block">
                            <div
                                id="workspace-menu-panel"
                                role="region"
                                aria-label="Workspace controls"
                                className={`mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-border-subtle bg-surface-base shadow-soft transition-all duration-500 ease-out z-10 ${
                                    isMenuOpen
                                        ? 'opacity-100 max-h-[320px] mt-4'
                                        : 'opacity-0 max-h-0 -translate-y-2 pointer-events-none'
                                }`}
                            >
                                <div className="grid gap-6 p-6 md:grid-cols-3">
                                    <div>
                                        <Text variant="small" className="uppercase tracking-[0.2em] text-accent-secondary/60 mb-3">
                                            Color mode
                                        </Text>
                                        <div className="flex items-center gap-3">
                                            {['Light', 'Dark'].map((mode) => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => handleColorModeChange(mode)}
                                                    className={`flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                                                        colorMode === mode
                                                            ? 'border-border-soft bg-surface-muted text-accent-secondary'
                                                            : 'border-border-subtle text-accent-secondary/70 hover:border-accent-primary/50 hover:bg-accent-primary/5'
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

                                    <div>
                                        <Text variant="small" className="uppercase tracking-[0.2em] text-accent-secondary/60 mb-3">
                                            Language
                                        </Text>
                                        <div className="flex items-center gap-3">
                                            {['ENG', 'DE'].map((lang) => (
                                                <button
                                                    key={lang}
                                                    type="button"
                                                    onClick={() => handleLanguageChange(lang)}
                                                    className={`flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                                                        language === lang
                                                            ? 'border-border-soft bg-surface-muted text-accent-secondary'
                                                            : 'border-border-subtle text-accent-secondary/70 hover:border-accent-primary/50 hover:bg-accent-primary/5'
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
                                    </div>

                                    <div>
                                        <Text variant="small" className="uppercase tracking-[0.2em] text-accent-secondary/60 mb-3">
                                            Account
                                        </Text>
                                        <div className="rounded-2xl border border-border-subtle/70 bg-surface-muted/60 px-4 py-3 text-center">
                                            <p className="text-sm font-semibold text-accent-secondary mb-2">
                                                {user?.first_name || user?.username || 'User'}
                                            </p>
                                            {isAuthenticated ? (
                                                <Button variant="danger" className="w-full" onClick={logout}>
                                                    Logout
                                                </Button>
                                            ) : (
                                                <Text variant="small">Not signed in</Text>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {isMenuOpen && (
                                    <div className="px-6 pb-6">
                                        <Text variant="small" className="text-center text-accent-secondary/50">

                                        </Text>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Spacing between menu and content when menu is open */}
                        {isMenuOpen && <div className="mb-8"></div>}

                        {isAuthenticated ? (
                            <>
                                <section className="mb-10">
                                    <div className="grid gap-6 lg:grid-cols-3">
                                        <div className="lg:col-span-2 bg-surface-base border border-border-subtle rounded-3xl p-6 shadow-soft">
                                            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.3em] text-accent-primary/60 font-semibold mb-2">Welcome back</p>
                                                    <Heading level={2} className="mb-3 text-4xl font-bold text-accent-secondary">
                                                        Hi, {user?.first_name || user?.username || "there"}!
                                                    </Heading>
                                                    <Text variant="default" className="text-accent-secondary/80">
                                                        Here's a quick look at what's happening across your meeting rooms right now.
                                                    </Text>
                                                </div>
                                                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                                                    {stats.map((item) => (
                                                        <div key={item.label} className="rounded-2xl border border-border-subtle/70 bg-surface-muted/70 px-5 py-4 hover:border-accent-primary/30 hover:shadow-md transition-all duration-200">
                                                            <p className="text-xs uppercase tracking-wider font-semibold text-accent-secondary/70">{item.label}</p>
                                                            <p className="text-3xl font-bold text-accent-primary mt-2">{item.value}</p>
                                                            <p className="text-sm text-accent-secondary/70 mt-1">{item.helper}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {nextBooking && (
                                                <div className="mt-6 rounded-2xl border-2 border-accent-primary/40 bg-gradient-to-br from-surface-muted/80 to-accent-primary/5 px-6 py-4 flex items-center justify-between shadow-lg shadow-accent-primary/10">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.3em] text-accent-primary/70 font-semibold">Next up</p>
                                                        <p className="text-lg font-bold text-accent-primary mt-2">
                                                            {nextBooking.room_name || nextBooking.room || "Room"}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-base font-semibold text-accent-primary">
                                                            {DateTime.fromISO(nextBooking.start_time).toFormat("ccc, dd MMM")}
                                                        </p>
                                                        <p className="text-sm font-medium text-accent-primary/80">
                                                            {DateTime.fromISO(nextBooking.start_time).toFormat("HH:mm")} – {DateTime.fromISO(nextBooking.end_time).toFormat("HH:mm")}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-surface-base border border-border-subtle rounded-3xl p-6 shadow-soft">
                                            <div className="flex items-center justify-between mb-4">
                                                <p className="text-sm font-semibold text-accent-secondary">What’s new</p>
                                                <span className="text-xs text-accent-secondary/50">This month</span>
                                            </div>
                                            <div className="space-y-4">
                                                {whatsNewItems.map((item) => (
                                                    <div key={item.title} className="rounded-2xl border border-border-subtle/70 bg-surface-muted/60 px-4 py-3">
                                                        <p className="text-xs uppercase tracking-[0.2em] text-accent-secondary/50">{item.date}</p>
                                                        <p className="text-sm font-semibold text-accent-secondary mt-1">{item.title}</p>
                                                        <p className="text-xs text-accent-secondary/70 mt-1">{item.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="mb-12">
                                    <Heading level={2} className="mb-6">
                                        Available Rooms
                                    </Heading>
                                    <RoomList rooms={rooms} onBook={handleBookingCreated} />
                                </section>

                                <section className="mb-12">
                                    <AvailabilityCalendar bookings={bookings} />
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
                    </div>

                    <div
                        className={`fixed inset-0 z-40 md:hidden ${isMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
                        aria-hidden={!isMenuOpen}
                    >
                        <div
                            className={`absolute inset-0 bg-surface-base transition-opacity duration-300 ${isMenuOpen ? 'opacity-90' : 'opacity-0'}`}
                            onClick={() => setIsMenuOpen(false)}
                            aria-hidden="true"
                        />
                        <div
                            role="dialog"
                            aria-modal="true"
                            ref={menuPanelRef}
                            tabIndex={-1}
                            className={`relative ml-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-surface-base px-6 py-8 shadow-soft transition-transform duration-300 ease-out ${
                                isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
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
                                                            ? 'border-border-soft bg-surface-muted text-accent-secondary'
                                                            : 'border-border-subtle text-accent-secondary/80 hover:border-accent-primary/50 hover:bg-accent-primary/5'
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

                                    <div className="h-px bg-border-subtle" aria-hidden="true" />

                                    <div>
                                        <Text variant="muted" className="mb-3 text-xs uppercase tracking-[0.2em]">Color mode</Text>
                                        <div className="flex items-center gap-3">
                                            {['ENG', 'DE'].map((lang) => (
                                                <button
                                                    key={lang}
                                                    type="button"
                                                    onClick={() => handleLanguageChange(lang, { closeMenu: true })}
                                                    className={`flex-1 rounded-2xl border px-4 py-3 text-base font-semibold transition ${
                                                        language === lang
                                                            ? 'border-border-soft bg-surface-muted text-accent-secondary'
                                                            : 'border-border-subtle text-accent-secondary/80 hover:border-accent-primary/50 hover:bg-accent-primary/5'
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
                                    </div>
                                </div>

                                {isMenuOpen && (
                                    <div className="mt-6 pt-6 border-t border-border-subtle/70">
                                        <Text variant="small" className="text-center text-accent-secondary/50">
                                           
                                        </Text>
                                    </div>
                                )}

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
                </>
            )}
        </div>
    );
}



