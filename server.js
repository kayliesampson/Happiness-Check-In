const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const net = require("net");

const PORT = Number(process.env.PORT || 3000);
const SMTP_HOST = process.env.SMTP_HOST || "localhost";
const SMTP_PORT = Number(process.env.SMTP_PORT || 1025);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const FROM_EMAIL = process.env.FROM_EMAIL || "checkin@example.com";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], submissions: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHeader(value) {
  return String(value).replace(/[\r\n]/g, " ").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dotStuff(message) {
  return message
    .split(/\r?\n/)
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function smtpConversation(message) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(SMTP_PORT, SMTP_HOST);
    const commands = [
      { label: "HELO", data: "HELO localhost\r\n", expect: 250 },
      { label: "MAIL FROM", data: `MAIL FROM:<${FROM_EMAIL}>\r\n`, expect: 250 },
      { label: "RCPT TO", data: `RCPT TO:<${message.to}>\r\n`, expect: 250 },
      { label: "DATA", data: "DATA\r\n", expect: 354 },
      { label: "message body", data: `${dotStuff(message.data)}\r\n.\r\n`, expect: 250 },
      { label: "QUIT", data: "QUIT\r\n", expect: 221 }
    ];
    let index = 0;
    let settled = false;
    let responseBuffer = "";
    let lastCommand = "connection greeting";

    function fail(error) {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(error);
      }
    }

    function sendNext() {
      if (index >= commands.length) {
        if (!settled) {
          settled = true;
          socket.end();
          resolve();
        }
        return;
      }

      const command = commands[index];
      lastCommand = command.label;
      socket.write(command.data);
      index += 1;
    }

    function expectedCode() {
      if (lastCommand === "connection greeting") return 220;
      return commands[index - 1].expect;
    }

    function handleResponse(response) {
      const code = Number(response.slice(0, 3));
      const expected = expectedCode();
      if (code !== expected) {
        fail(new Error(`SMTP error after ${lastCommand}: ${response.trim()}`));
        return;
      }

      if (lastCommand === "QUIT") {
        if (!settled) {
          settled = true;
          socket.end();
          resolve();
        }
        return;
      }

      sendNext();
    }

    socket.setTimeout(6000, () => fail(new Error("SMTP connection timed out")));
    socket.on("error", fail);
    socket.on("data", (chunk) => {
      responseBuffer += chunk.toString("utf8");
      const lines = responseBuffer.split(/\r?\n/);
      responseBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line) continue;
        if (/^\d{3} /.test(line)) {
          handleResponse(line);
          if (settled) return;
        }
      }
    });
  });
}

function buildEmail({ to, name, token }) {
  const link = `${APP_BASE_URL}/checkin/${token}`;
  const greeting = name ? `Hi ${name},` : "Hi,";
  const htmlGreeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const text = `${greeting}

Here is your Daily Check-In.

Take a few minutes to breathe, reflect, notice gratitude, and set an intention:
${link}

Wishing you a steady day,
Daily Check-In`;

  const html = `<!doctype html>
<html>
  <body style="font-family: Campton, 'Avenir Next', Avenir, Montserrat, Arial, Helvetica, sans-serif; color: #392E44; line-height: 1.5; background: #EBE8E4; padding: 24px;">
    <h1 style="color: #392E44;">Your Daily Check-In</h1>
    <p>${htmlGreeting}</p>
    <p>Take a few minutes to breathe, reflect, notice gratitude, and set an intention.</p>
    <p>
      <a href="${link}" target="_blank" rel="noopener noreferrer" style="background:#ff474f;color:white;padding:12px 16px;border:1px solid #ff474f;border-radius:6px;text-decoration:none;display:inline-block;font-weight:700;">
        Start check-in
      </a>
    </p>
    <p style="color:#392E44;font-size:14px;">
      If the button does not open, use this link:<br>
      <a href="${link}" target="_blank" rel="noopener noreferrer" style="color:#392E44;">${link}</a>
    </p>
    <p style="color:#392E44;">Wishing you a steady day,<br>Daily Check-In</p>
  </body>
</html>`;

  const boundary = `boundary-${crypto.randomBytes(8).toString("hex")}`;
  const data = [
    `From: Daily Check-In <${FROM_EMAIL}>`,
    `To: ${escapeHeader(to)}`,
    `Subject: Your Daily Check-In`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="utf-8"`,
    "",
    text,
    `--${boundary}`,
    `Content-Type: text/html; charset="utf-8"`,
    "",
    html,
    `--${boundary}--`
  ].join("\r\n");

  return { to, data };
}

async function sendCheckInEmail(user) {
  await smtpConversation(buildEmail({ to: user.email, name: user.name, token: user.token }));
}

async function handleSignup(req, res) {
  try {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const name = String(body.name || "").trim().slice(0, 80);

    if (!isValidEmail(email)) {
      sendJson(res, 400, { error: "Please enter a valid email address." });
      return;
    }

    const store = readStore();
    let user = store.users.find((candidate) => candidate.email === email);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        token: crypto.randomBytes(24).toString("hex"),
        email,
        name,
        createdAt: new Date().toISOString()
      };
      store.users.push(user);
    } else if (name) {
      user.name = name;
    }

    writeStore(store);
    await sendCheckInEmail(user);
    sendJson(res, 200, {
      message: "Check your local Mailpit inbox for your Daily Check-In email.",
      mailpitUrl: "http://localhost:8025",
      checkInUrl: `${APP_BASE_URL}/checkin/${user.token}`
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      error: `Could not send the check-in email. SMTP said: ${error.message}`
    });
  }
}

function getUserFromToken(token) {
  const store = readStore();
  const user = store.users.find((candidate) => candidate.token === token);
  return { store, user };
}

function handleCheckInInfo(token, res) {
  const { store, user } = getUserFromToken(token);
  if (!user) {
    sendJson(res, 404, { error: "This check-in link was not found." });
    return;
  }
  const latest = store.submissions
    .filter((submission) => submission.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  sendJson(res, 200, {
    name: user.name,
    email: user.email,
    previousSubmissionAt: latest ? latest.createdAt : null
  });
}

async function handleCheckInSubmit(req, res, token) {
  try {
    const { store, user } = getUserFromToken(token);
    if (!user) {
      sendJson(res, 404, { error: "This check-in link was not found." });
      return;
    }

    const body = await readBody(req);
    const responses = {
      reflection: String(body.reflection || "").trim().slice(0, 2000),
      gratitude: String(body.gratitude || "").trim().slice(0, 2000),
      intention: String(body.intention || "").trim().slice(0, 2000)
    };

    if (!responses.reflection || !responses.gratitude || !responses.intention) {
      sendJson(res, 400, { error: "Please complete each written step before submitting." });
      return;
    }

    const submission = {
      id: crypto.randomUUID(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      responses
    };
    store.submissions.push(submission);
    writeStore(store);
    sendJson(res, 201, { message: "Your check-in has been saved.", submission });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Could not save this check-in." });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, APP_BASE_URL);
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  if (filePath.startsWith("/checkin/")) filePath = "/index.html";

  const resolved = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolved, (error, content) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(resolved);
    res.writeHead(200, { "content-type": CONTENT_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, APP_BASE_URL);

  if (req.method === "POST" && url.pathname === "/api/signup") {
    await handleSignup(req, res);
    return;
  }

  const match = url.pathname.match(/^\/api\/checkins\/([a-f0-9]+)$/);
  if (match && req.method === "GET") {
    handleCheckInInfo(match[1], res);
    return;
  }
  if (match && req.method === "POST") {
    await handleCheckInSubmit(req, res, match[1]);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.listen(PORT, () => {
  ensureStore();
  console.log(`Daily Check-In running at ${APP_BASE_URL}`);
  console.log(`SMTP target: ${SMTP_HOST}:${SMTP_PORT}`);
});
