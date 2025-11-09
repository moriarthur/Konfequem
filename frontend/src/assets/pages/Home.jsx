import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import BookingList from "../../components/BookingList";
import RoomList from "../../components/RoomList";

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
                console.error("Error fetching data:", err);
            }
        };

        fetchData();
    }, [authFetch, isAuthenticated]);

    // Called when a new booking is created
    const handleBookingCreated = (newBooking) => {
        // Add to global bookings list
        setBookings((prev) => [...prev, newBooking]);
        // NOTE: Intentionally do NOT mutate `rooms` here. BookingList is the
        // single source of truth for showing bookings. Keeping room-level
        // bookings in sync caused duplication and inconsistent rendering.
    };

    return (
        <div className="min-h-screen bg-gray-100 px-6 py-12 relative">
            {loading && <p className="text-center mt-20 text-gray-600">Loading...</p>}

            {!loading && (
                <>
                    <header className="flex justify-between items-center mb-6">
                        <h1 className="text-4xl font-bold text-gray-900">
                            Welcome, {user?.first_name || user?.username} 👋
                        </h1>
                        {isAuthenticated && (
                            <button
                                onClick={logout}
                                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                            >
                                Logout
                            </button>
                        )}
                    </header>

                    <p className="text-lg text-gray-600 mb-4">
                        Manage your rooms and bookings
                    </p>

                    {isAuthenticated ? (
                        <>
                            <RoomList rooms={rooms} onBook={handleBookingCreated} />

                            <section className="mt-12">
                                <h2 className="text-2xl font-semibold mb-2">
                                    Your Bookings
                                </h2>
                                {bookings.length > 0 ? (
                                    <BookingList bookings={bookings} />
                                ) : (
                                    <p className="text-gray-600">No bookings found.</p>
                                )}
                            </section>
                        </>
                    ) : (
                        <p className="text-center text-gray-600">
                            Please log in to see rooms and bookings.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
