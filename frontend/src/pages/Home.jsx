import React, { useState, useEffect } from "react";
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
                    <header className="flex justify-between items-center mb-8">
                        <div>
                            <Heading level={1} className="mb-2">
                                Welcome, {user?.first_name || user?.username} 👋
                            </Heading>
                            <Text variant="large" className="text-gray-600">
                                Manage your rooms and bookings
                            </Text>
                        </div>
                        {isAuthenticated && (
                            <Button
                                variant="danger"
                                onClick={logout}
                            >
                                Logout
                            </Button>
                        )}
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
