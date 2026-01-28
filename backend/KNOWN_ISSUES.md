# Known Issues and Solutions

## Backend Testing Issues

### 1. E2E Tests - ATOMIC_REQUESTS Error
**Status**: ⚠️ UNRESOLVED

**Issue**: 
```
KeyError: 'ATOMIC_REQUESTS'
```

Occurs when using `@pytest.mark.django_db(transaction=True)` with SQLite in Django 4.2.

**Root Cause**: Django 4.2's `make_view_atomic()` function accesses `settings_dict["ATOMIC_REQUESTS"]` directly (without `.get()`), causing KeyError when the key doesn't exist.

**Affected Tests**: All E2E tests in `tests/e2e/test_booking_flow.py`

**Workarounds Attempted**:
1. Added `ATOMIC_REQUESTS: True` to database config - Still failed
2. Set `ATOMIC_REQUESTS: False` - Still failed
3. Created standalone test settings - Still failed

**Recommended Solution**: Use PostgreSQL for E2E tests instead of SQLite

**Implementation**:
```bash
# Set DATABASE_URL to PostgreSQL before running E2E tests
export DATABASE_URL=postgres://user:pass@localhost:5432/testdb
pytest tests/e2e/ -v
```

---

### 2. Booking PUT/PATCH - 415 Unsupported Media Type
**Status**: ⚠️ UNRESOLVED

**Issue**: 
```
assert 415 == 200
```

Occurs on `test_update_own_booking` and `test_partial_update_booking`.

**Likely Causes**:
- Missing or incorrect Content-Type header
- ViewSet doesn't support PATCH/PUT for some reason
- DRF renderer/parser configuration issue

**Tests Affected**:
- `tests/integration/test_views.py::TestBookingViewSet::test_update_own_booking`
- `tests/integration/test_views.py::TestBookingViewSet::test_partial_update_booking`

**Investigation Needed**: Check APIClient default headers and view configuration

---

### 3. Admin Interface Conflicts
**Status**: ✅ RESOLVED

**Issue**: `admin_interface` package expected `ATOMIC_REQUESTS` in database settings

**Solution**: Removed from `INSTALLED_APPS` in `config/settings_test.py`

**Before**:
```python
INSTALLED_APPS = [
    'admin_interface',  # <-- Caused ATOMIC_REQUESTS errors
    ...
]
```

**After**:
```python
INSTALLED_APPS = [
    # admin_interface removed for tests
    'django.contrib.admin',
    ...
]
```

---

## Frontend Testing Issues

### Status: ⚠️ NOT YET TESTED

Frontend tests have been created but not executed. Expected issues:

1. **Import Path Aliases**: Vitest path aliases need to match Vite config
2. **MSW Integration**: May need additional setup for React 19
3. **Testing Library Version**: React 19 may have compatibility issues
4. **Luxon Timezone**: Ensure consistent timezone handling

**Installation Required**:
```bash
cd frontend
npm install
npm test
```

---

## Common Configuration Issues

### Issue: pytest-django not finding settings

**Error**: `django.core.exceptions.ImproperlyConfigured: SECRET_KEY setting`

**Solution**: Ensure DJANGO_SETTINGS_MODULE is set in pytest.ini:
```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings_test
```

---

### Issue: Tests run slowly

**Cause**: Database migrations running for each test

**Solution**: Use `--reuse-db` flag in pytest.ini:
```ini
addopts = --reuse-db
```

---

### Issue: Coverage report shows 0%

**Cause**: Python cache not cleared after settings changes

**Solution**:
```bash
find . -type d -name "__pycache__" -exec rm -rf {} +
pytest tests/ --cov
```

---

## Django + SQLite Specific Issues

### Issue: NOT NULL constraints not enforced

**SQLite quirk**: SQLite doesn't enforce NOT NULL constraints in the same way as PostgreSQL

**Impact**: Tests expecting IntegrityError may not fail as expected

**Solution**: Use `full_clean()` method for model validation instead of relying on database constraints:

```python
# Instead of:
with pytest.raises(Exception):
    Room.objects.create(location='Floor 1', capacity=10)

# Use:
room = Room(location='Floor 1', capacity=10)
with pytest.raises(ValidationError):
    room.full_clean()
```

---

### Issue: Timezone handling differs between SQLite and PostgreSQL

**Impact**: Tests passing on SQLite may fail on PostgreSQL due to timezone implementation differences

**Recommendation**: Run integration tests against PostgreSQL before merging

---

## Debugging Tips

### View Actual SQL Queries
```python
import logging
logging.getLogger('django.db.backends').setLevel(logging.DEBUG)
```

### See What Django Receives
```python
# In test
import json
print("Request data:", json.dumps(data, indent=2))
print("Response status:", response.status_code)
print("Response data:", response.data)
```

### Check Settings
```python
from django.conf import settings
print("DATABASES:", settings.DATABASES)
print("INSTALLED_APPS:", settings.INSTALLED_APPS)
```

---

## Resolution Priority

1. ✅ **HIGH**: Unit tests - All passing (68/68)
2. ✅ **HIGH**: Integration tests (authentication, room views) - 75% passing (51/68)
3. ⚠️ **MEDIUM**: Integration tests (booking CRUD) - 415 errors on PUT/PATCH
4. ⚠️ **LOW**: E2E tests - Transaction handling issue (use PostgreSQL instead)
