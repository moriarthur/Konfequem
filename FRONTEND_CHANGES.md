# Frontend Changes Log

## 2025-02-07 - Icon System Overhaul & Mobile Calendar UI Improvements

### Icon System Migration

**Change:** Replaced all Heroicons (@heroicons/react) with custom SVG icons from svgrepo.com

**Reasoning:**
- Consistent icon design from a single collection
- Better control over icon appearance
- `fill="currentColor"` allows icons to inherit theme colors
- Reduced bundle size (no external icon library dependency)

### Icon Replacements by Component

#### BottomNav.jsx
| Icon | SVG Source |
|------|-----------|
| Home | https://svgrepo.com/svg/522898/home |
| Rooms | https://www.svgrepo.com/svg/448755/door|
| Calendar | https://svgrepo.com/svg/522391/calendar |
| Profile | https://svgrepo.com/svg/523092/user-circle |

#### ProfilePage.jsx
| Icon | SVG Source |
|------|-----------|
| User | Same as BottomNav Profile icon (consistency) |
| Settings | https://svgrepo.com/svg/523734/settings |
| Notifications | https://svgrepo.com/svg/522763/bell |
| Email | https://svgrepo.com/svg/533200/mail-alt-3 |
| Logout | https://svgrepo.com/svg/522931/logout-2 (flipped horizontally) |

#### Home.jsx
| Icon | SVG Source |
|------|-----------|
| Plus (Quick Book) | https://svgrepo.com/svg/524223/add-square |
| Clock (Time display) | https://svgrepo.com/svg/524426/clock-circle |
| Check (Status badge) | https://svgrepo.com/svg/524415/check-circle |
| X (Close) | https://svgrepo.com/svg/533032/xmark-large |
| Chevron Right | https://svgrepo.com/svg/522374/chevron-right |
| Stopwatch (Office Info) | https://svgrepo.com/svg/525069/stopwatch |
| Info (Office Info) | https://svgrepo.com/svg/524660/info-circle |

#### CalendarPage.jsx
| Icon | SVG Source |
|------|-----------|
| Chevron Left | https://svgrepo.com/svg/522373/chevron-left |
| Chevron Right | https://svgrepo.com/svg/522374/chevron-right |
| Clock (Time display) | https://svgrepo.com/svg/524426/clock-circle |
| Check (Status badge) | https://svgrepo.com/svg/524415/check-circle |
| Edit (Pencil) | https://svgrepo.com/svg/523561/edit-2 |
| Trash (Delete) | https://svgrepo.com/svg/525035/trash |

#### RoomList.jsx
| Icon | SVG Source |
|------|-----------|
| Building (Empty state) | https://svgrepo.com/svg/523995/buildings-2 |

### Mobile Calendar UI Improvements

**Problem:** Mobile calendar cells were too small with truncated booking text like `"14:30 Conf..."`

**Solution:** Availability dots system for mobile (< 640px)

**Implementation:**
- 🟢 Green dot = Current booking (happening now)
- 🟡 Yellow dot = Next upcoming booking
- ⚪ Gray dots = Other future bookings
- Maximum 3 visible dots with `+` indicator for overflow
- Tap any day with dots to expand and see full booking details

**Desktop:** Unchanged - still shows booking pills with time and room name

### Files Modified
- `frontend/src/components/BottomNav.jsx`
- `frontend/src/components/RoomList.jsx`
- `frontend/src/index.css` (added expandIn animation)
- `frontend/src/pages/CalendarPage.jsx`
- `frontend/src/pages/Home.jsx`
- `frontend/src/pages/ProfilePage.jsx`

### Dependencies Removed
- `@heroicons/react/24/outline` - no longer needed

### CSS Additions (index.css)
```css
@keyframes expandIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-expand-in { animation: expandIn 0.2s ease-out forwards; }
```

---

## Previous Changes (from summary)

### Expandable Calendar Days with Inline Editing

**CalendarPage.jsx** - Added ability to click on calendar day cells to expand them and show detailed booking information with inline edit/delete capabilities.

**Key Features:**
- Click day cell → expands to fill calendar grid
- Shows booking details: time range, duration, room info, status badges
- Inline editing: time inputs, validation, save/cancel
- Delete with confirmation modal
- Month navigation disabled when viewing expanded day

**Home.jsx** - Made upcoming bookings clickable to navigate to calendar edit mode

### Validation & Error Handling

**Comprehensive validation added:**
- End time must be after start time
- Minimum 15 minutes, Maximum 8 hours duration
- Office hours: 08:00 - 22:00
- Cannot book in the past
- Overlap detection with existing bookings
- Race condition protection (isMountedRef pattern)
- Unsaved changes warning (beforeunload event)
- Timezone consistency (OFFICE_TIMEZONE constant)
- Specific error handling: 409 Conflict, 400, 401, 403, 404

### Bug Fixes

1. **Invalid DateTime error** - Fixed by removing quotes around OFFICE_TIMEZONE constant and adding null/isValid checks
2. **Delete button white/invisible** - Fixed by using explicit color classes (bg-red-600)
3. **Time zone consistency** - Replaced hardcoded "Europe/Berlin" with OFFICE_TIMEZONE constant
