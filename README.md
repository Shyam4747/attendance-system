# Attendance System

Independent fingerprint and face recognition attendance system.

## Version 1 scope

- Admin dashboard
- Student/employee management
- Face profile registration hook
- Face attendance matching API hook
- Manual attendance fallback
- Attendance reports
- Fingerprint profile placeholder for future scanner SDK integration

## Project structure

```text
attendance-system
  backend
  frontend
  docs
```

## MongoDB

Create a `.env` file in `backend`:

```env
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/attendance
```

If your Mongo connection named `attendance` gives you a different URI, place it in `MONGODB_URI`.

## Run

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Biometric notes

Face recognition and fingerprint scanners are adapter-based. The app stores biometric references, but the actual fingerprint SDK can be connected later after choosing hardware.
