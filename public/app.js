const app = document.querySelector("#app");

const state = {
  step: 0,
  token: location.pathname.startsWith("/checkin/")
    ? location.pathname.split("/").filter(Boolean)[1]
    : null,
  user: null,
  responses: {
    reflection: "",
    gratitude: "",
    intention: ""
  },
  savedSubmission: null
};

const steps = [
  {
    key: "breathe",
    title: "Take a few calm breaths.",
    prompt:
      "Let your shoulders soften. Breathe in slowly, pause, and breathe out. Stay here for three cycles before moving on."
  },
  {
    key: "reflection",
    title: "How are you feeling right now?",
    prompt:
      "There is no right answer. Notice what is here with as little judgement as you can.",
    label: "What do you notice?"
  },
  {
    key: "gratitude",
    title: "What are you grateful for today?",
    prompt: "It can be tiny, ordinary, or unfinished. Small good things count.",
    label: "Today I am grateful for..."
  },
  {
    key: "intention",
    title: "Set one positive intention.",
    prompt:
      "Choose one thing you would like to do to make positive progress today.",
    label: "One thing I intend to do today is..."
  }
];

function html(strings, ...values) {
  return strings.reduce((result, string, index) => {
    const value = values[index] ?? "";
    return result + string + value;
  }, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(target, text, isError = false) {
  const element = document.querySelector(target);
  if (!element) return;
  element.className = `message${isError ? " error" : ""}`;
  element.textContent = text;
  element.hidden = false;
}

function renderSignup() {
  app.className = "shell";
  app.innerHTML = html`
    <section class="hero">
      <div>
        <h1>Daily Check-In</h1>
        <p class="lede">
          A gentle practice for pausing, noticing how you are, naming
          gratitude, and choosing one positive intention for the day.
        </p>
        <div class="practice-strip" aria-label="Check-in steps">
          <div class="practice-tile"><strong>Breathe</strong><span>Arrive with a few slow breaths.</span></div>
          <div class="practice-tile"><strong>Reflect</strong><span>Notice feelings without judgement.</span></div>
          <div class="practice-tile"><strong>Gratitude</strong><span>Name one good thing, however small.</span></div>
          <div class="practice-tile"><strong>Intention</strong><span>Choose one positive next step.</span></div>
        </div>
      </div>

      <form class="signup-panel" id="signupForm">
        <h2>Send me today’s check-in</h2>
        <div class="field">
          <label for="name">Name</label>
          <input id="name" name="name" autocomplete="name" placeholder="Optional" />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com" />
        </div>
        <div class="actions">
          <button class="primary" type="submit">Send check-in email</button>
        </div>
        <p id="signupMessage" class="message" hidden></p>
      </form>
    </section>
  `;

  document.querySelector("#signupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    button.textContent = "Sending...";

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email")
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");
      setMessage(
        "#signupMessage",
        `${data.message} Open Mailpit at ${data.mailpitUrl}.`
      );
    } catch (error) {
      setMessage("#signupMessage", error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "Send check-in email";
    }
  });
}

async function loadCheckIn() {
  app.className = "shell checkin-wrap";
  app.innerHTML = `<section class="checkin-panel step"><p>Loading your check-in...</p></section>`;

  try {
    const response = await fetch(`/api/checkins/${state.token}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "This check-in could not be loaded.");
    state.user = data;
    renderStart();
  } catch (error) {
    app.innerHTML = html`
      <section class="checkin-panel step">
        <div>
          <p class="step-kicker">Link problem</p>
          <h1>We could not open this check-in.</h1>
          <p>${escapeHtml(error.message)}</p>
          <div class="actions"><a class="primary" href="/">Request a new email</a></div>
        </div>
      </section>
    `;
  }
}

function renderStart() {
  const greeting = state.user?.name ? `Hi, ${escapeHtml(state.user.name)}` : "Hi";
  app.className = "shell checkin-wrap";
  app.innerHTML = html`
    <section class="checkin-panel start-panel">
      <div>
        <p class="step-kicker">${greeting}</p>
        <h1>Ready to begin?</h1>
        <p>
          This will take a few quiet minutes. You will breathe, reflect, name
          one thing you are grateful for, and set a positive intention for today.
        </p>
        <div class="actions">
          <button class="primary" id="startButton" type="button">Start check-in</button>
        </div>
      </div>
    </section>
  `;

  document.querySelector("#startButton").addEventListener("click", () => {
    state.step = 0;
    renderStep();
  });
}

function progressHtml() {
  return html`
    <div class="progress" aria-label="Progress">
      ${steps
        .map((_, index) => `<span class="${index <= state.step ? "active" : ""}"></span>`)
        .join("")}
    </div>
  `;
}

function renderStep() {
  const current = steps[state.step];
  app.className = "shell checkin-wrap";

  if (state.savedSubmission) {
    renderComplete();
    return;
  }

  const input = current.key === "breathe"
    ? html`
        <div class="breath-space" aria-label="Breathing animation">
          <div class="breath-circle">Breathe</div>
        </div>
      `
    : html`
        <div>
          <div class="field">
            <label for="${current.key}">${current.label}</label>
            <textarea id="${current.key}" maxlength="2000">${escapeHtml(state.responses[current.key] || "")}</textarea>
          </div>
        </div>
      `;

  app.innerHTML = html`
    <section class="checkin-panel">
      ${progressHtml()}
      <div class="step">
        <div>
          <h1>${current.title}</h1>
          <p>${current.prompt}</p>
          <div class="actions">
            ${state.step > 0 ? `<button class="secondary" id="backButton" type="button">Back</button>` : ""}
            <button class="primary" id="nextButton" type="button">
              ${state.step === steps.length - 1 ? "Submit check-in" : "Continue"}
            </button>
          </div>
          <p id="stepMessage" class="message" hidden></p>
        </div>
        ${input}
      </div>
    </section>
  `;

  const textarea = document.querySelector("textarea");
  if (textarea) {
    textarea.focus();
    textarea.addEventListener("input", (event) => {
      state.responses[current.key] = event.target.value;
    });
  }

  document.querySelector("#backButton")?.addEventListener("click", () => {
    state.step -= 1;
    renderStep();
  });

  document.querySelector("#nextButton").addEventListener("click", async () => {
    if (current.key !== "breathe") {
      const value = document.querySelector(`#${current.key}`).value.trim();
      if (!value) {
        setMessage("#stepMessage", "Add a short response before continuing.", true);
        return;
      }
      state.responses[current.key] = value;
    }

    if (state.step < steps.length - 1) {
      state.step += 1;
      renderStep();
      return;
    }

    await submitCheckIn();
  });
}

async function submitCheckIn() {
  const button = document.querySelector("#nextButton");
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    const response = await fetch(`/api/checkins/${state.token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state.responses)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save your check-in.");
    state.savedSubmission = data.submission;
    renderComplete();
  } catch (error) {
    setMessage("#stepMessage", error.message, true);
    button.disabled = false;
    button.textContent = "Submit check-in";
  }
}

function renderComplete() {
  app.innerHTML = html`
    <section class="checkin-panel">
      ${progressHtml()}
      <div class="step">
        <div>
          <p class="step-kicker">Complete</p>
          <h1>Your check-in is saved.</h1>
          <p>Thanks for taking a few minutes to arrive, notice, appreciate, and choose a positive next step.</p>
          <div class="actions">
            <a class="primary" href="https://actionforhappiness.org/">Visit Action for Happiness</a>
          </div>
        </div>
        <div class="summary" aria-label="Your responses">
          <div class="summary-item">
            <strong>Feeling</strong>
            <p>${escapeHtml(state.responses.reflection)}</p>
          </div>
          <div class="summary-item">
            <strong>Gratitude</strong>
            <p>${escapeHtml(state.responses.gratitude)}</p>
          </div>
          <div class="summary-item">
            <strong>Intention</strong>
            <p>${escapeHtml(state.responses.intention)}</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

if (state.token) {
  loadCheckIn();
} else {
  renderSignup();
}
