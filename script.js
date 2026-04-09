/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

/*
  Choose ONE option:
  1) Direct OpenAI call from browser (for classroom/demo use)
  2) Cloudflare Worker URL (recommended for production)
*/
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const WORKER_URL = ""; // Example: "https://your-worker.your-subdomain.workers.dev"

// Keep full conversation so the assistant has context.
const messages = [
  {
    role: "system",
    content:
      "You are a friendly L'Oreal beauty advisor. Give clear beginner-friendly product (products form L'Oreal and child companies ONLY, NO EXCEPTIONS(La Roche-Posay, CeraVe, Vichy, SkinCeuticals, Skinbetter Science, Maybelline New York, NYX Professional Makeup, Essie, Carol's Daughter,Lancôme, Yves Saint Laurent (YSL) Beauty, Armani Beauty, Kiehl's, Prada Beauty, Valentino, Ralph Lauren Fragrances, and Mugler)) and routine advice. If needed, ask follow-up questions about skin type, goals, and budget. Include pruduct prices in parentheses. DO NOT HALLUCINATE PRODUCTS/INFO. If a user message is unrelated to beauty or not a clarification response, say you do not know and respond with a friendly redirection to steer the conversation back to makeup, skincare, and routines. Ask related follow-up questions to get the information you need to give the best advice. Always respond in a positive and helpful tone. NEVER break character.",
  },
];

// Initial assistant message shown in the chat UI.
appendMessage("ai", "Hi!👋 What are you looking for today?");

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  userInput.value = "";

  // Add the user's message to conversation history.
  messages.push({ role: "user", content: text });

  setLoading(true);

  try {
    const reply = await getAssistantReply(messages);

    appendMessage("ai", reply);

    // Save assistant response to history so next answer has context.
    messages.push({ role: "assistant", content: reply });
  } catch (error) {
    appendMessage("ai", `Sorry, I ran into an error: ${error.message}`);
  } finally {
    setLoading(false);
  }
});

async function getAssistantReply(conversation) {
  const requestBody = {
    model: "gpt-4o",
    messages: conversation,
    max_completion_tokens: 800,
  };

  // If WORKER_URL is set, call your Cloudflare Worker.
  if (WORKER_URL) {
    const workerResponse = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: conversation }),
    });

    if (!workerResponse.ok) {
      throw new Error(`Worker request failed (${workerResponse.status})`);
    }

    const data = await workerResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No message content returned from Worker");
    }

    return content;
  }

  // Otherwise, call OpenAI directly from the browser using OPENAI_API_KEY from secrets.js.
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in secrets.js");
  }

  const openaiResponse = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    throw new Error(
      `OpenAI request failed (${openaiResponse.status}): ${errorText}`,
    );
  }

  const data = await openaiResponse.json();

  // Required response access pattern for this project.
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No message content returned from OpenAI");
  }

  return content;
}

function appendMessage(type, text) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("msg", type);
  messageEl.textContent = text;
  messageEl.id = `msg-${Date.now()}`;
  chatWindow.appendChild(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageEl;
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  userInput.disabled = isLoading;

  if (isLoading) {
    // Show "Thinking..." message
    window.thinkingEl = appendMessage("thinking", "Thinking...");
  } else {
    // Remove "Thinking..." message when done
    if (window.thinkingEl) {
      window.thinkingEl.remove();
      window.thinkingEl = null;
    }
  }
}
