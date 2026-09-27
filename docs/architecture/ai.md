# Refill resolution intelligence

Zeno keeps refill state and workflow transitions in the Spring Boot API. The
LangGraph service at `apps/ai` receives a bounded context assembled by the API,
interprets the deterministic blocker, validates evidence, and returns a typed
operational recommendation. It has no database connection and cannot mutate a
refill, approve or deny a prescription, or make clinical decisions.

```text
RefillDetail → Spring Boot → deterministic triage / resolution case
                            → apps/ai FastAPI → LangGraph workflow
                            ← validated recommendation
                            → audit event + resolution_cases.ai_recommendation
```

The `refill_resolution` graph loads the supplied context, interprets the
backend blocker, checks for contradictory evidence, plans the next operational
step, applies the deterministic safety gate, and formats a Pydantic-validated
recommendation. Only the planning node calls the configured model. Mock mode is
the default and needs no external credentials. Provider-backed model selection
is configured through `LLM_PROVIDER` and the matching API key. For OpenRouter,
set `LLM_PROVIDER=openrouter` and `OPENROUTER_API_KEY`; the default model is
`nvidia/nemotron-3-ultra-550b-a55b:free`. Free model availability and rate
limits are controlled by OpenRouter and can change. Zeno validates the model's
JSON against its own schemas because this model does not enforce JSON response
formatting. OpenRouter's free endpoint says not to submit personal or
confidential information and logs usage; the service therefore refuses to
start with a `:free` model unless `ENVIRONMENT=development`. Use synthetic demo
records only with that endpoint. Do not use it for live patient records.

The safety gate derives the safety class and human approval requirement from
the selected action after model reasoning. Unknown actions fail closed, and
clinical override actions are forbidden. The UI shows the explanation, cited
input fields, next step, owner, and human review requirement. A recommendation
never applies itself or changes a refill's workflow state.

For seeded demo accounts, opening an unresolved blocked refill automatically
requests and saves a recommendation when that case has none. Other accounts
can request one from the refill detail page. This is a demo convenience; every
recommendation still requires human review before anyone takes action. Calls
have a bounded timeout and retry count. Unavailable, invalid, or disabled AI
returns a manual-workflow message and does not prevent the deterministic refill
flow. AI request and response metadata are recorded without logging the full
patient payload.

When a seeded demo account submits a refill whose prescription has a
deterministic blocker, the backend also runs triage immediately, creates an
open resolution case, and records a pending action. The audit timeline records
the request, automated triage, blocker, case, and action. This automation does
not mark an unblocked refill READY or approve a prescription; a person must
review and complete the pending work. Audit entries identify engine-generated
events as Automated; a manually started triage entry names the user who started
it.

Run the Python checks with `cd apps/ai && pytest -q`, the backend checks with
`cd apps/api && ./gradlew test`, and the frontend production build with
`cd apps/web && npm run build`. The Compose stack starts the AI service in mock
mode by default; set `AI_SERVICE_API_KEY` to a shared secret to enable
service-to-service authentication.
