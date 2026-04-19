# Daily Check-In

An interactive digital version of the Action for Happiness Daily Check-In practice.

Users can sign up with an email address, receive a Daily Check-In email through a local Mailpit SMTP service, open the emailed link, and walk through four steps:

- Breathe
- Reflect
- Gratitude
- Intention

Responses are saved to a small JSON data store mounted as a Docker volume.

## Run

```bash
docker compose up --build
```

Then open:

- App: http://localhost:3000
- Mailpit inbox: http://localhost:8025

## How To Try It

1. Open http://localhost:3000.
2. Enter a name and email address.
3. Open http://localhost:8025 and select the Daily Check-In email.
4. Click the email link.
5. Complete and submit the check-in.

## Local Development Without Docker

If you have Node 20+ and Mailpit running on `localhost:1025`:

```bash
npm start
```

## Implementation Notes

This project intentionally avoids application dependencies. The backend uses Node's built-in HTTP, filesystem, crypto, and network modules. The frontend is plain HTML/CSS/JavaScript so the repository stays easy to clone and run.

The local SMTP implementation is deliberately small and targets Mailpit for assignment verification. In production, this should be replaced with a mature email service/provider integration.
