# Demo video script (~90 seconds)

Recording setup: 1440x900 browser window, demo account
(`demo-reviewer`), clean browser profile (no extra tabs/bookmarks).
Record with any screen recorder; narration is optional — the on-screen
action carries the story. Below: EN narration lines with RU stage
directions.

| # | Time | Screen action | Narration (EN) | Заметки (RU) |
|---|------|---------------|----------------|--------------|
| 1 | 0:00–0:10 | README on GitHub — show Live Demo + screenshots | "Konfequem — a multi-tenant room booking platform. Django REST framework, React 19, TypeScript, PostgreSQL, fully deployed." | Начало: README, ссылка на демо. Можно ускорить (2x) |
| 2 | 0:10–0:20 | Open live demo → login as `demo-reviewer` | "Let me show the core flow on the live demo." | Логин заранее набрать в буфер, чтобы не показывать опечатки |
| 3 | 0:20–0:30 | Home dashboard — stats + upcoming booking | "The dashboard shows what's free right now and my next meeting." | Просто прокрутить, ничего не нажимать |
| 4 | 0:30–0:45 | Rooms → "Book this room" → pick date, slot, duration → Book | "Booking is three clicks: date, time slot, duration. The server enforces office hours and blocks double-bookings." | Выбрать заведомо свободный слот; курсор не торопить |
| 5 | 0:45–0:55 | Calendar → click today → booking card appears | "The booking lands on the calendar immediately." | Кликнуть на сегодняшнюю клетку с точками |
| 6 | 0:55–1:10 | Same slot, second browser window / incognito — second user books overlapping slot → conflict warning | "And if a colleague tries to take the same slot, they get a live conflict check." | Второе окно: зарегистрировать второй org? Нет — конфликты видны только внутри org. Лучше: в первом окне занять слот, затем во втором (тоже demo-... нет, demo-тот же юзер — конфликта не будет!) |
| 7 | 1:10–1:25 | (Plan B for #6) Rooms filters by capacity/features | "Rooms can be filtered by capacity and equipment." | План Б: если второй юзер сложный для записи — показать фильтры |
| 8 | 1:25–1:35 | Close on README — tech stack + testing section | "Backend rules are covered by 241 pytest tests, component tests, and a full browser E2E of this exact flow." | Финал: секция Testing в README |

**Note on scene 6:** overlap conflicts are org-scoped — to show a real
conflict you need a *second user in the same org*. Easiest: join the demo
org via its invite key (Django admin → Organizations) with a second
account before recording, then book the same slot from two browser
profiles. If that's fiddly, fall back to scene 7 (filters) — or show the
frontend conflict banner by booking the same slot twice in one account:
the second attempt shows the same "Booking Conflict" warning.

Зателлап: ~1:35 в спокойном темпе; можно ужать до 1:10 ускорением
переходов между страницами.
