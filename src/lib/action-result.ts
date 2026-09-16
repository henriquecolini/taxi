/**
 * Error keys shown to users. Each key has a translation under `errors.*`
 * in `messages/*.json`.
 */
export type ErrorKey =
  | "invalidInput"
  | "locked"
  | "overlap"
  | "endBeforeStart"
  | "invoiceDateNotAfterPrevious"
  | "invoiceDateInFuture"
  | "invoiceRunningTimer"
  | "invoiceNotLatest"
  | "invoiceEmpty"
  | "memberIsOwner"
  | "memberExists"
  | "repositoryExists"
  | "invalidLogo"
  | "gitlabNotConfigured"
  | "gitlabError"
  | "aiNotConfigured"
  | "aiDisabled"
  | "aiError"
  | "importInvalid";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ErrorKey };
