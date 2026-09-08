# Pathway Agent design system

The interface uses a calm operational visual language: navy navigation, ivory canvas, white evidence surfaces and dark teal actions. The guided entry explains the problem and bounded demonstration; the workspace emphasizes the next action and its authority. Exact evidence stays available without turning raw infrastructure metadata into the primary workflow.

The installed `ui-ux-pro-max` skill was read before implementation. Its first healthcare search recommended neumorphism and testimonials, which conflicted with this project and was rejected. A narrower `enterprise operations dashboard minimal` design-system search returned an appropriate Swiss/minimal enterprise pattern and was persisted to [MASTER](../design-system/pathway-agent/MASTER.md). Reviewed [application overrides](../design-system/pathway-agent/pages/application.md) define the actual palette, type, layout, scope language and interaction behavior.

Implementation is dependency-free semantic HTML, CSS tokens and browser ES modules in `web/`. The Node application serves the compiled production assets. Data always comes from authenticated, isolated application service calls. The illustrated landing-page journey is labeled a preview; no fake business statistics, testimonials or customer logos appear.

Core UI rules: minimum 44px action controls, visible keyboard focus, semantic labels/headings, live request feedback, retained inline errors, text-plus-color status indicators and reduced-motion support. Navigation wraps at small widths. Raw identifiers and evidence JSON wrap rather than expand the viewport. No remote font or image dependencies are required.

Primary screens are the guided portfolio entry, SC-01 case workspace, evidence-grounded interaction, Knowledge Studio, evidence inspector and human review queue. Studio separates sandbox upload/collections from published Knowledge Pack releases and assignments. Public fixture uploads are deliberately constrained to supplied synthetic TXT files and server-enforced validation.

Browser verification must inspect 375, 768, 1024 and 1440px, keyboard operation, loading/error/paused/escalated/completed states, and the actual persisted golden/exception/retirement journeys. See the application verification report for executed checks; this document records design decisions, not a substitute for runtime QA.
