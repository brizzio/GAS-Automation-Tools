/**
 * AIAnalyzeRowWeb  –  v2  (always uses web search, then formats if requested)
 *
 * @param {Range} headerRange  1-row range with column headers (e.g., A1:D1)
 * @param {Range} dataRange    1-row range with values       (e.g., A2:D2)
 * @param {string} prompt      Your question/instruction
 * @param {string} [outputType="text"]
 *        "text" (default) | "number" | "currency" | "percentage" | "date" |
 *        "list" | "json" | "options:value1,value2,value3"
 *
 * @return {string|number}  Model response, already parsed/cleaned.
 */
function AIAnalyzeRowWeb(headerRange, dataRange, prompt, outputType) {
  outputType = outputType || "text";

  const apiKey = PropertiesService.getScriptProperties()
                 .getProperty('OPEN_AI_API_KEY');
  if (!apiKey) return 'Error: OPEN_AI_API_KEY not set in Script Properties.';

  /* ---------- Turn the row into a simple “header: value” list ---------- */
  let headers = headerRange, values = dataRange;
  if (headers.length) headers = headers[0];
  if (values.length)  values  = values[0];

  const tableText = headers.map((h, i) => `${h}: ${values[i]}`).join('\n');

  /* ---------- First pass – search-preview model ---------- */
  const searchPrompt = `
${prompt}

Here are the column-value pairs for the record:
${tableText}

${getFormatInstructions(outputType)}

Use the most up-to-date public information you can find via web search.
`.trim();

  const searchAnswer = callOpenAISearch(searchPrompt, apiKey);

  /* ---------- If caller only wants free-form text, return now ---------- */
  const schema = generateOutputSchema(outputType);
  if (!schema) return processResponse(searchAnswer, outputType);

  /* ---------- Second pass – schema-capable model ---------- */
  const structPrompt = `
You are a data formatter. Convert the following answer into JSON that matches the given schema *exactly*.

Schema:
${JSON.stringify(schema, null, 2)}

Answer:
${searchAnswer}
`.trim();

  const structJson = callOpenAIStruct(structPrompt, apiKey, schema);
  return processResponse(structJson, outputType);
}

/* ====================================================================== */
/* ============================  HELPERS  =============================== */
/* ====================================================================== */

/** 1️⃣  Search-preview call – NO extra params allowed  */
function callOpenAISearch(message, apiKey) {
  const payload = {
    model: 'gpt-4o-mini-search-preview',
    messages: [{ role: 'user', content: message }],
    web_search_options: {}                 // turns the tool on
    // ⛔️ Do NOT add temperature, max_tokens, etc.
  };

  const res = UrlFetchApp.fetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const j = JSON.parse(res.getContentText());
  if (j.error) return `API Error: ${j.error.message}`;
  return (j.choices && j.choices.length)
         ? j.choices[0].message.content.trim()
         : 'No response from search model.';
}

/** 2️⃣  Structured-output call – regular model parameters OK  */
function callOpenAIStruct(message, apiKey, schema) {
  const payload = {
    model: 'gpt-4o-2024-08-06',
    messages: [{ role: 'user', content: message }],
    temperature: 0.0,
    max_tokens: 1500,
    response_format: {
      type: "json_schema",
      json_schema: { name: "structured_response", strict: true, schema }
    }
  };

  const res = UrlFetchApp.fetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const j = JSON.parse(res.getContentText());
  if (j.error) return `API Error: ${j.error.message}`;

  const msg = j.choices?.[0]?.message;

  // 1️⃣ Success path – the schema validator passed
  if (msg?.parsed) return JSON.stringify(msg.parsed);

  // 2️⃣ Try to salvage JSON from the text (if the validator failed)
  try {
    const match = msg.content.match(/\{[\s\S]*\}/);
    if (match) return match[0];                 // raw JSON string
  } catch (_) {}

  // 3️⃣ Last fallback – return plain text so you at least see something
  return msg?.content ? msg.content.trim() : 'No structured response.';
}
/** Build JSON schema for structured output (same logic as v1). */
function generateOutputSchema(outputType) {
  if (!outputType || outputType === "text" || outputType === "json") return null;

  const base = { type: "object", additionalProperties: false, required: ["value"] };
  switch (true) {
    case outputType === "number":
      base.properties = { value: { type: "number" } }; break;
    case outputType === "currency":
      base.properties = {
        value: { type: "number" },
        currency: { type: "string" }
      };
      base.required.push("currency"); break;
    case outputType === "percentage":
      base.properties = { value: { type: "number" } }; break;
    case outputType === "date":
      base.properties = { value: { type: "string", format: "date" } }; break;
    case outputType === "list":
      base.properties = { value: { type: "array", items: { type: "string" } } }; break;
    case outputType.startsWith("options:"):
      const opts = outputType.substring(8).split(',').map(s => s.trim());
      base.properties = { value: { type: "string", enum: opts } }; break;
    case outputType.startsWith("multioptions:"):
      const multi = outputType.substring(13).split(',').map(s => s.trim());
      base.properties = {
      value: {
      type: "array",
      minItems: 0,
      items: { type: "string", enum: multi }
      }
      };
      break;
    default:
      return null;
  }
  return base;
}

/** Short, plain-language hints for the first pass. */
function getFormatInstructions(outputType) {
  if (!outputType || outputType === "text") return "Provide a clear, comprehensive text answer.";
  const map = {
    number:      "Return the numerical value only.",
    currency:    "Return number and ISO currency code.",
    percentage:  "Return the percentage as a decimal (e.g., 0.15).",
    date:        "Return the date in YYYY-MM-DD.",
    list:        "Return a bullet list of items.",
    json:        "Return a well-formed JSON object."
  };
  if (outputType.startsWith("options:")) {
    const opts = outputType.substring(8);
    return `Return exactly one of these values: ${opts}.`;
  } else if (outputType.startsWith("multioptions:")) {
  const opts = outputType.substring(13);
  return `Return a comma-separated list of **all** matching values from: ${opts}.`;
  }
  return map[outputType] || "Provide the answer in the requested format.";
}

/** Convert raw (string or JSON) into user-friendly return value. */
function processResponse(raw, outputType) {
  if (!outputType || outputType === "text") return raw;

  try {
    const parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
    switch (true) {
      case outputType === "number":
      case outputType === "percentage":
        return parsed.value;
      case outputType === "currency":
        return `${parsed.currency} ${parsed.value}`;
      case outputType === "date":
        return parsed.value;
      case outputType === "list":
        return parsed.value.join(", ");
      case outputType.startsWith("options:"):
        return parsed.value;
      case outputType.startsWith("multioptions:"):
        return Array.isArray(parsed.value)
         ? parsed.value.join(", ")
         : parsed.value;   // if model gives a string
      case outputType === "json":
        return JSON.stringify(parsed, null, 2);
    }
  } catch (e) {
    // If parsing fails, just return whatever we got.
  }
  return raw;
}

/* ------------------------------------------------------------------ */
/* -------------------  API-key convenience helper  ----------------- */
/* ------------------------------------------------------------------ */

/**
 * Run once, paste your key, then delete or comment the line.
 */
function setupApiKey() {
  // PropertiesService.getScriptProperties().setProperty(
  //   'OPEN_AI_API_KEY',
  //   'sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  // );
  Logger.log('API key saved.');
}
