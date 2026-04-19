# Reflection

## Trade-offs

I chose a small dependency-free Node application instead of a full React framework. React would have made the interactive check-in familiar to build, but for a 90-minute assignment the main risk is setup and infrastructure friction rather than component complexity. Plain JavaScript keeps the repo easy to clone, quick to inspect, and simple to run with Docker Compose.

The app uses a JSON file as its data store and sends email through Mailpit with a minimal SMTP client built on Node's `net` module. That keeps external dependencies out of the critical path while still meeting the requirement that the system sends real email to a local SMTP service. With more time, I would use a real database, add scheduled daily sending, and move email delivery behind a tested mail library or provider SDK.

I designed the check-in flow to feel calm and focused: one step at a time, a breathing animation first, then simple written prompts for reflection, gratitude, and intention. The goal was to show the actual practice working rather than spend time on admin screens.

## Limitations

The biggest production weakness is durability and scale. A JSON file is fine for a demo, but concurrent writes, backups, migrations, and analytics would quickly become painful. The SMTP code is intentionally minimal and only suitable for Mailpit-style local delivery. It does not handle authentication, TLS, retries, bounce management, or provider-specific errors.

The system sends a check-in email when a user signs up, but it does not yet include a scheduler for automatic daily emails. Links are token-based and unexpired, which is convenient for the exercise but too permissive for production. There is also no authentication, unsubscribe flow, rate limiting, audit trail, or privacy controls around stored responses.

## AI Usage

I used AI-assisted coding to plan the implementation, generate the first version of the server, frontend, Docker setup, and documentation, then reviewed and adjusted the result for the assignment constraints. The main judgement calls were keeping the architecture small, avoiding dependency installation risk, and making sure the email path worked through local SMTP rather than pretending to send email.

Areas that needed human-style correction were scope control and production honesty: deciding not to overbuild a full React stack, documenting that daily scheduling is not implemented, and making the reflection clear about what would need to change before this became a real user-facing service.
