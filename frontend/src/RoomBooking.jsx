import React, { useState, useEffect } from 'react';
import './RoomBooking.css';

export default function RoomBooking() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({
    room: '',
    user: 1, // пока что суперюзер
    start_time: '',
    end_time: ''
  });

  // Загружаем список комнат и бронирований при загрузке
  useEffect(() => {
  console.log('⏳ Загружаем комнаты...');
  fetch('http://localhost:8000/api/rooms/')
    .then(res => {
      console.log('✅ Статус ответа комнат:', res.status);
      return res.json();
    })
    .then(data => {
      console.log('📦 Данные комнат:', data);
      setRooms(data);
    });

  console.log('⏳ Загружаем бронирования...');
  fetch('http://localhost:8000/api/bookings/')
    .then(res => {
      console.log('✅ Статус ответа бронирований:', res.status);
      return res.json();
    })
    .then(data => {
      console.log('📦 Данные бронирований:', data);
      setBookings(data);
    });
}, []);
  const handleSubmit = (e) => {
  e.preventDefault();

  fetch('http://localhost:8000/api/bookings/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form)
  })
    .then(res => res.json())
    .then(newBooking => {
      setBookings([...bookings, newBooking]);
      alert('Бронирование добавлено!');
    });
};


  return (
    <div>
      <h2>Забронировать переговорную</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Переговорная:
          <select
            value={form.room}
            onChange={(e) => setForm({ ...form, room: Number(e.target.value) })}
            required
          >
            <option value="">— выберите —</option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <br />
        <label>
          Дата начала:
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            required
          />
        </label>
        <br />
        <label>
          Дата окончания:
          <input
            type="datetime-local"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            required
          />
        </label>
        <br />
        <button type="submit">Забронировать</button>
      </form>

      <h2>Список бронирований</h2>
      <ul>
        {bookings.map(b => (
          <li key={b.id}>
            Комната {b.room}, с {new Date(b.start_time).toLocaleString()} до {new Date(b.end_time).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
