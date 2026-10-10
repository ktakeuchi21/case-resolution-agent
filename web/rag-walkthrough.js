// Informational tours never activate the controls they describe.
export function createWalkthrough() {
  let run = null, frame = 0, observer = null, observedTarget = null;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const targetFor = step => {
    try {
      const target = typeof step.target === 'function' ? step.target() : step.target ? document.querySelector(step.target) : null;
      if (!(target instanceof Element) || !target.isConnected) return null;
      const rect = target.getBoundingClientRect(), style = getComputedStyle(target);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.visibility !== 'collapse' ? target : null;
    } catch { return null; }
  };
  const selectorFor = element => {
    if (element.id) return '#' + CSS.escape(element.id);
    for (const selector of ['.thread-scroll', '.context-sidebar', '.drawer-content']) {
      if (element.matches(selector)) return selector;
    }
    const parts = [];
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const index = Array.prototype.indexOf.call(node.parentElement?.children || [], node) + 1;
      parts.unshift(node.localName + ':nth-child(' + index + ')');
    }
    return 'body > ' + parts.join(' > ');
  };
  function rememberScroll(target) {
    for (let node = target?.parentElement; node && node !== document.body; node = node.parentElement) {
      if (node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth) continue;
      const selector = selectorFor(node);
      if (!run.scrolls.has(selector)) run.scrolls.set(selector, { node, top: node.scrollTop, left: node.scrollLeft });
    }
  }
  function schedule() {
    if (!run || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; position(); });
  }
  function position() {
    if (!run) return;
    const { card, highlight, dialog } = run;
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
    const originX = viewport?.offsetLeft || 0, originY = viewport?.offsetTop || 0;
    const margin = 12, gap = 16, cardWidth = Math.min(360, width - margin * 2);
    card.style.width = cardWidth + 'px';
    card.style.maxHeight = Math.max(100, height - margin * 2) + 'px';
    const cardHeight = card.getBoundingClientRect().height;
    if (run.body.scrollHeight > run.body.clientHeight) run.body.tabIndex = 0;
    else run.body.removeAttribute('tabindex');
    const target = targetFor(run.steps[run.index]);
    if (target !== observedTarget) {
      if (observedTarget) observer?.unobserve(observedTarget);
      observedTarget = target;
      if (target) observer?.observe(target);
    }
    dialog.classList.toggle('is-unanchored', !target);
    highlight.hidden = !target;
    const minX = originX + margin, minY = originY + margin;
    const maxX = Math.max(minX, originX + width - margin - cardWidth);
    const maxY = Math.max(minY, originY + height - margin - cardHeight);
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    let left = originX + (width - cardWidth) / 2, top = originY + (height - cardHeight) / 2;
    if (target) {
      const rect = target.getBoundingClientRect();
      // Clip the ring to the screen when a section is taller than the viewport.
      const bounds = {
        left: clamp(rect.left - 5, originX + 5, originX + width - 5),
        right: clamp(rect.right + 5, originX + 5, originX + width - 5),
        top: clamp(rect.top - 5, originY + 5, originY + height - 5),
        bottom: clamp(rect.bottom + 5, originY + 5, originY + height - 5),
      };
      Object.assign(highlight.style, { left: bounds.left + 'px', top: bounds.top + 'px',
        width: Math.max(0, bounds.right - bounds.left) + 'px', height: Math.max(0, bounds.bottom - bounds.top) + 'px' });
      highlight.hidden = bounds.right <= bounds.left || bounds.bottom <= bounds.top;
      const centerX = (bounds.left + bounds.right - cardWidth) / 2;
      const centerY = (bounds.top + bounds.bottom - cardHeight) / 2;
      const candidates = [
        { left: bounds.right + gap, top: centerY, side: 'right' },
        { left: bounds.left - cardWidth - gap, top: centerY, side: 'left' },
        { left: centerX, top: bounds.bottom + gap, side: 'below' },
        { left: centerX, top: bounds.top - cardHeight - gap, side: 'above' },
      ].map((candidate, order) => {
        const x = clamp(candidate.left, minX, maxX), y = clamp(candidate.top, minY, maxY);
        const overlapX = Math.max(0, Math.min(x + cardWidth, bounds.right) - Math.max(x, bounds.left));
        const overlapY = Math.max(0, Math.min(y + cardHeight, bounds.bottom) - Math.max(y, bounds.top));
        const movement = Math.abs(candidate.left - x) + Math.abs(candidate.top - y);
        return { left: x, top: y, side: candidate.side, score: overlapX * overlapY * 10 + movement + order };
      });
      candidates.sort((a, b) => a.score - b.score);
      ({ left, top } = candidates[0]);
      dialog.dataset.placement = candidates[0].side;
    } else dialog.dataset.placement = 'center';
    card.style.left = clamp(left, minX, maxX) + 'px';
    card.style.top = clamp(top, minY, maxY) + 'px';
  }
  function showStep() {
    const step = run.steps[run.index];
    run.heading.textContent = step.title;
    run.body.textContent = step.body;
    run.body.scrollTop = 0;
    run.progress.textContent = (run.index + 1) + ' of ' + run.steps.length;
    run.back.disabled = run.index === 0;
    run.next.textContent = run.index === run.steps.length - 1 ? 'Done' : 'Next';
    const target = targetFor(step);
    if (target) {
      rememberScroll(target);
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
    position();
    run.heading.focus({ preventScroll: true });
    schedule();
  }
  function move(direction) {
    if (!run) return;
    let next = run.index + direction;
    while (next >= 0 && next < run.steps.length && run.steps[next].target && !targetFor(run.steps[next])) next += direction;
    if (next >= run.steps.length) { close(); return; }
    if (next < 0) return;
    run.index = next;
    showStep();
  }
  function close({ restoreFocus = true } = {}) {
    if (!run) return;
    const previous = run;
    run = null;
    cancelAnimationFrame(frame); frame = 0;
    observer?.disconnect(); observer = null; observedTarget = null;
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule, true);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
    previous.dialog.close();
    previous.dialog.remove();
    for (const [selector, saved] of previous.scrolls) {
      const node = saved.node.isConnected ? saved.node : document.querySelector(selector);
      node?.scrollTo({ left: saved.left, top: saved.top, behavior: 'instant' });
    }
    window.scrollTo({ left: previous.windowScroll.left, top: previous.windowScroll.top, behavior: 'instant' });
    if (restoreFocus) {
      const trigger = previous.trigger?.isConnected ? previous.trigger : previous.triggerId ? document.getElementById(previous.triggerId) : null;
      (trigger || document.getElementById('main'))?.focus({ preventScroll: true });
    }
  }
  function start({ title = 'Pathway walkthrough', steps = [], trigger } = {}) {
    close({ restoreFocus: false });
    const available = steps.filter(step => step && typeof step.title === 'string' && (!step.target || targetFor(step)));
    if (!available.length) return;
    const dialog = make('dialog', 'walkthrough-dialog');
    dialog.setAttribute('aria-labelledby', 'walkthrough-title');
    dialog.setAttribute('aria-describedby', 'walkthrough-body');
    const highlight = make('div', 'walkthrough-highlight'); highlight.setAttribute('aria-hidden', 'true');
    const card = make('section', 'walkthrough-card');
    const topline = make('div', 'walkthrough-topline');
    const label = make('p', 'eyebrow', title);
    const dismiss = make('button', 'button walkthrough-close', '×');
    dismiss.type = 'button'; dismiss.setAttribute('aria-label', 'Close walkthrough'); dismiss.title = 'Close walkthrough (Escape)';
    dismiss.addEventListener('click', () => close());
    topline.append(label, dismiss);
    const progress = make('p', 'walkthrough-progress'); progress.id = 'walkthrough-progress';
    const heading = make('h2', 'walkthrough-title'); heading.id = 'walkthrough-title'; heading.tabIndex = -1;
    heading.setAttribute('aria-describedby', 'walkthrough-progress walkthrough-body');
    const body = make('p', 'walkthrough-body'); body.id = 'walkthrough-body';
    const controls = make('div', 'walkthrough-controls');
    const back = make('button', 'button secondary', 'Back'), next = make('button', 'button primary', 'Next');
    back.type = next.type = 'button';
    back.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
    controls.append(back, next); card.append(topline, progress, heading, body, controls); dialog.append(highlight, card);
    run = { dialog, card, highlight, progress, heading, body, back, next, steps: available, index: 0,
      trigger: trigger || document.activeElement, triggerId: (trigger || document.activeElement)?.id,
      scrolls: new Map(), windowScroll: { top: window.scrollY, left: window.scrollX } };
    available.forEach(step => rememberScroll(targetFor(step)));
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', () => { if (run?.dialog === dialog) close(); });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const stops = [...dialog.querySelectorAll('button:not(:disabled), .walkthrough-body[tabindex="0"]')];
      const index = stops.indexOf(document.activeElement);
      if (index === -1 || (!event.shiftKey && index === stops.length - 1) || (event.shiftKey && index === 0)) {
        event.preventDefault(); stops[event.shiftKey ? stops.length - 1 : 0]?.focus();
      }
    });
    document.body.append(dialog);
    dialog.showModal();
    observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(card);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    showStep();
  }
  return { start, close, refresh: schedule, get active() { return Boolean(run); } };
}
