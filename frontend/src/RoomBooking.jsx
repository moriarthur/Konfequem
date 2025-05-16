import React, { useState } from 'react'; // Импортируем React и useState для управления состоянием
import './RoomBooking.css'; // Импортируем CSS для стилей

// Массив переговорных комнат — для примера просто три названия
const rooms = ['Room A', 'Room B', 'Room C'];

// Функциональный React-компонент
export default function RoomBooking() {
  // useState — хук для создания состояния внутри компонента
  // selectedRoom — выбранная переговорная, изначально первая в списке
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]);

  // date и time — состояния для даты и времени брони
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Функция, которая сработает при отправке формы
  const handleSubmit = (e) => {
    e.preventDefault(); // Отменяем стандартное обновление страницы при submit
    alert(`Забронировали: ${selectedRoom} на ${date} в ${time}`); // Просто показываем данные
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Переговорная:
        <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}>
          {rooms.map((room) => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>
      </label>
      <br />
      <label>
        Дата:
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <br />
      <label>
        Время:
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>
      <br />
      <button type="submit">Забронировать</button>
    </form>
  );
}
