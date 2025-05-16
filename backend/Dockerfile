# Используем официальный Python образ, версия 3.11
FROM python:3.11-slim

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем файл с зависимостями в контейнер
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Копируем весь проект в контейнер
COPY . .

# Команда для запуска сервера разработки Django (позже заменим на gunicorn)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
