# Reflection

## Personal
I was experiencing a lot of joy building this :) Thank you for this opportunity!

## Trade-offs

I chose a small dependency-free Node application instead of a full React framework. React would have made the interactive check-in familiar to build.

The app uses a JSON file as its data store and sends email through Mailpit with a minimal SMTP client built on Node's `net` module. With more time, I would use a real database, add scheduled daily sending, and move email delivery behind a tested mail library or provider SDK.

I had a lot of ideas on how to make it more inteactive in general, but only had so much time.

## Limitations

The biggest weakness is durability and scale. A JSON file is fine for a demo, but concurrent writes, backups, migrations, and analytics would quickly become painful.

The system sends a check-in email when a user signs up, but it does not yet include a scheduler for automatic daily emails. Links are token-based and unexpired, which is convenient for the exercise but too permissive for production. There is also no authentication, unsubscribe flow, rate limiting, audit trail, or privacy controls around stored responses.

## AI Usage

I used AI-assisted coding to plan the implementation, generate the first version of the server, frontend, Docker setup, and documentation, then reviewed and adjusted the result for the assignment constraints. The main judgement calls were keeping the architecture small, avoiding dependency installation risk, and making sure the email path worked through local SMTP rather than pretending to send email.
