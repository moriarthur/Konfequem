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
                    <header className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 mb-10">
                        <div className="flex items-center gap-6">
                            <Link to="/" className="flex items-center gap-3 shrink-0">
                                <img
                                    src="/konfequem_logo.svg"
                                    alt="Konfequem logo"
                                    className="w-12 h-12 rounded-xl shadow-sm"
                                />
                                <div className="leading-tight">
                                    <p className="text-xs uppercase tracking-wide text-gray-500">Konfequem</p>
                                    <span className="text-lg font-semibold text-gray-900">Workspace</span>
                                </div>
                            </Link>

                            <div className="flex-1 text-center">
                                <Heading level={1} className="mb-1">
                                    {user?.first_name || user?.username}
                                </Heading>
                                <Text variant="large" className="text-gray-600">
                                    Meeting Rooms Manager
                                </Text>
                            </div>

                            <div className="shrink-0 flex justify-end">
                                {isAuthenticated && (
                                    <Button
                                        variant="danger"
                                        onClick={logout}
                                    >
                                        Logout
                                    </Button>
                                )}
                            </div>
                        </div>
                    </header>

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
