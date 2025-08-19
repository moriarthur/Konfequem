import React, { useState } from "react";

export default function BookingForm({ rooms, onBookingSubmit }) {
  const [formData, setFormData] = useState({
    room: "",
    start_time: "",
    end_time: "",
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = (e) => {
    e.preventDefault();
    onBookingSubmit(formData);
    setFormData({ room: "", start_time: "", end_time: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-white p-6 rounded-2xl shadow-md my-6">
      <h2 className="text-2xl font-semibold mb-4 text-center">Book a Room</h2>

      <label className="block mb-2">
        Room
        <select name="room" value={formData.room} onChange={handleChange} required className="w-full border rounded-md p-2">
          <option value="">Select a room</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>

      <label className="block mb-2">
        Start Time
        <input type="datetime-local" name="start_time" value={formData.start_time} onChange={handleChange} required className="w-full border rounded-md p-2" />
      </label>

      <label className="block mb-2">
        End Time
        <input type="datetime-local" name="end_time" value={formData.end_time} onChange={handleChange} required className="w-full border rounded-md p-2" />
      </label>

      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">Book Room</button>
    </form>
  );
}
