# Pathway Agent application decisions

These reviewed application rules override the generated MASTER recommendations for all portfolio and workspace screens. The generated enterprise operations / minimal query matched Swiss-style enterprise applications. The initial healthcare query returned neumorphism and testimonial guidance and was rejected before persistence. No testimonials, gradients or neumorphic controls are used.

- Palette: ink/navigation `#142c36`, primary/action `#156553` with white text, ivory canvas `#f5f5ef`, white panels, secondary text `#536870`, borders `#d7dfda`. Warning text `#805018` on `#fff3dc`; danger `#a1322b` on `#fff0ec`. Status includes words and a marker, never color alone.
- Typography: Inter if installed, then native system sans-serif. No external font request; stable system rendering and no third-party font network dependency. Body 16px, secondary operational text 13–14px, metadata 11–12px. Headlines 30px in workspaces, fluid 40–64px portfolio hero. Long machine IDs use wrapping monospace.
- Layout: 216px navy navigation at desktop, collapses into wrapping navigation above content at 800px. Content gutters 36/24/18px. Workspace prioritizes current state and next action, followed by timeline and evidence/communications. No meaningless charts or fabricated metrics.
- Interaction: native controls, minimum 44px buttons, visible 3px teal keyboard focus, skip link, semantic headings, per-form labels/hints, disabled controls for wrong review role, live saving feedback and retained inline errors. Native details reveal raw audit data.
- Motion: 150ms color changes only; reduced-motion disables transitions and the activity pulse. No decorative animation.
- Safety in copy: synthetic scope stays visible in the application; generated language is not execution authority; delivery is separate from acknowledgment; final goal explicitly leaves prior authorization pending. Sandbox upload only accepts supplied synthetic fixtures.
- Routes: `#home`, `#workspace`, `#agent`, `#studio`, `#evidence`, `#review`. Hash navigation retains server-side persistent case context and supports browser back.
- Verification targets: 375, 768, 1024 and 1440px; keyboard-only critical path; no primary workflow overflow; runtime-service errors and explicit abstention. Actual QA evidence belongs in the verification report rather than design intentions.
