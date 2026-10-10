# Optional page walkthroughs

Scenarios, conversations, and Knowledge each offer a Walkthrough button. Tours use a pale 18% paper-colored veil and teal target outline. They are informational: they do not activate the highlighted controls, submit questions, apply knowledge, or call a model.

Conversation steps adapt to desktop case context or the mobile Case context button. Existing answers add evidence and activity explanations. Native dialogs contain keyboard focus, support Escape, and restore the trigger and independent scroll positions. The dialog lives outside the rerendered app; incoming answers preserve the current step. Overflowing explanations remain keyboard scrollable on short screens. Navigation closes the tour.

## Local verification

- Type checking, 89 core tests, 32 RAG tests, production build, syntax checks, and hygiene checks passed.
- Browser matrix: 48 tours, 186 steps. Scenarios, Knowledge, and all three conversation scenarios in Chat and Email at 375×760, 768×900, 1024×768, 1440×900, 375×500, and 740×375.
- Completion, heading focus, trigger-focus restoration, viewport containment, composer visibility after closing, and horizontal overflow checks passed. A landscape first-step overlap was corrected and its final targeted check passed with zero overlap.
- 21 interaction checks passed: keyboard containment in both directions, Escape, Back, scrollable explanations at 375×240, explanation scroll reset, unsent draft preservation, independent scroll restoration, no generation requests from tours, incoming-answer rerenders, historical sources/activity after reload, source/grounding controls, mobile context drawer, and navigation cleanup. Reduced motion was enabled for these checks; no browser errors were recorded.
- Visual checks covered desktop, portrait mobile, and landscape screenshots. Screen-reader semantics were inspected through the accessibility tree; this is not a claim of a full assistive-technology audit.

Browser checks used the local retained synthetic-response preview. No live model evaluation was needed for this presentation-only change. Model settings, rate limits, retrieval, generation, and persistence contracts are unchanged.

Local reproduction scripts and captures are retained under ignored `output/playwright/`: `check-walkthrough.cjs`, `check-walkthrough-behavior.cjs`, `walkthrough-matrix-final.log`, `walkthrough-landscape-final.log`, and `walkthrough-behavior.log`.
