// Error reports expose only connection metadata, never request content or tokens.
export function connectionDiagnostics(context, version) {
  if (!context || typeof context !== "object") return null;
  const details = {};
  const phases = {
    session: "ChatGPT sign-in",
    models: "Account availability",
    requirements: "Request preparation",
    account: "Account connection",
    connection: "Response connection",
    conversation: "Submitting the request",
    response: "Receiving the response"
  };
  if (typeof context.phase === "string" && Object.hasOwn(phases, context.phase)) details.stage = phases[context.phase];
  if (Number.isInteger(context.status) && context.status >= 100 && context.status <= 599) details.httpStatus = context.status;
  for (const key of ["code", "requestId"]) {
    const value = context[key] ?? context.error?.[key];
    if (typeof value === "string" && /^[a-z\d_.:-]{1,120}$/i.test(value)) details[key] = value;
  }
  if (typeof context.model === "string" && /^[a-z\d_.:-]{1,120}$/i.test(context.model)) details.automaticModel = context.model;
  if (!Object.keys(details).length) return null;
  if (typeof version === "string" && /^\d+(?:\.\d+){0,3}$/.test(version)) details.extensionVersion = version;
  return details;
}
