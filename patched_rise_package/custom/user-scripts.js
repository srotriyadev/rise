<script>
(function () {
  try {
    console.info('[Rise-MCQ] debug script starting...');

    // === CONFIG (update if you changed IDs) ===
    const MCQ_BLOCK_ID = 'cmhp2i4ek000w357kddog96e3';
    const PAR_BLOCK_ID = 'cmhpsr0ab000w357j515n4dki';
    const LOG_PREFIX = '[Rise-MCQ]';

    // === helper utilities ===
    const $ = (s, root = document) => (root || document).querySelector(s);
    const $$ = (s, root = document) => Array.from((root || document).querySelectorAll(s));

    function findBlockByDataId(id) {
      // try exact data-block-id, then partial, then data-test-id fallback
      let el = document.querySelector('[data-block-id="' + id + '"]');
      if (el) return el;
      el = document.querySelector('[data-block-id*="' + id + '"]');
      if (el) return el;
      // try searching by any element that contains the id text (last resort)
      el = Array.from(document.querySelectorAll('*')).find(n => {
        try { return n.getAttribute && (n.getAttribute('data-test-id') === id || (n.outerHTML && n.outerHTML.indexOf(id) !== -1)); } catch (e) { return false; }
      });
      return el || null;
    }

    function findParagraphTarget(parBlock) {
      if (!parBlock) return null;
      // try several likely selectors inside the paragraph block
      const tries = [
        'p',
        '.tiptap.ProseMirror',
        '.rise-tiptap',
        '[role="textbox"]',
        '.block__content p',
        '.block__wrap p'
      ];
      for (const sel of tries) {
        const el = parBlock.querySelector(sel);
        if (el) return el;
      }
      // fallback: return the block itself
      return parBlock;
    }

    function visible(el) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    function setParagraphColor(parEl, mode) {
      if (!parEl) {
        console.warn(LOG_PREFIX, 'no paragraph element to style');
        return;
      }
      // remove previous classes
      parEl.classList.remove('rise-mcq-correct', 'rise-mcq-incorrect');
      if (mode === 'correct') {
        parEl.style.color = 'green';
        parEl.classList.add('rise-mcq-correct');
        console.info(LOG_PREFIX, 'paragraph marked CORRECT (green)');
      } else if (mode === 'incorrect') {
        parEl.style.color = 'red';
        parEl.classList.add('rise-mcq-incorrect');
        console.info(LOG_PREFIX, 'paragraph marked INCORRECT (red)');
      } else if (mode === 'clear') {
        parEl.style.color = '';
        console.info(LOG_PREFIX, 'paragraph color cleared');
      }
    }

    function evaluateMCQAndMark(mcqBlock, parEl) {
      if (!mcqBlock) { console.warn(LOG_PREFIX, 'evaluate called but mcqBlock is null'); return; }
      if (!parEl) { console.warn(LOG_PREFIX, 'evaluate called but parEl is null'); return; }

      console.info(LOG_PREFIX, 'Evaluating MCQ DOM for feedback...');

      // 1) explicit feedback label text
      const fbLabel = mcqBlock.querySelector('.quiz-card__feedback-label, .quiz-card__feedback-wrap .quiz-card__feedback-label, .quiz-card__feedback');
      if (fbLabel && fbLabel.textContent && fbLabel.textContent.trim()) {
        const txt = fbLabel.textContent.trim();
        console.info(LOG_PREFIX, 'Found feedbackLabel text:', txt);
        if (/correct/i.test(txt)) { setParagraphColor(parEl, 'correct'); return; }
        if (/incorrect/i.test(txt)) { setParagraphColor(parEl, 'incorrect'); return; }
      } else {
        console.info(LOG_PREFIX, 'No explicit feedbackLabel text found (or empty).');
      }

      // 2) visible check or x SVG icons
      const checkSvgs = $$('.quiz-multiple-choice-option__check', mcqBlock);
      const xSvgs = $$('.quiz-multiple-choice-option__x', mcqBlock);
      console.info(LOG_PREFIX, 'Found checkSvgs:', checkSvgs.length, 'xSvgs:', xSvgs.length);
      if (checkSvgs.some(visible)) { console.info(LOG_PREFIX, 'Detected visible check icon -> correct'); setParagraphColor(parEl, 'correct'); return; }
      if (xSvgs.some(visible)) { console.info(LOG_PREFIX, 'Detected visible x icon -> incorrect'); setParagraphColor(parEl, 'incorrect'); return; }

      // 3) aria-live region
      const ariaLive = mcqBlock.querySelector('[aria-live="assertive"], [aria-live]');
      if (ariaLive && ariaLive.textContent && ariaLive.textContent.trim()) {
        const t = ariaLive.textContent.trim();
        console.info(LOG_PREFIX, 'aria-live text:', t);
        if (/correct/i.test(t)) { setParagraphColor(parEl, 'correct'); return; }
        if (/incorrect/i.test(t)) { setParagraphColor(parEl, 'incorrect'); return; }
      }

      // 4) fallback: search for "Correct"/"Incorrect" anywhere inside block text
      const text = (mcqBlock.textContent || '').trim();
      console.info(LOG_PREFIX, 'mcqBlock text snippet:', text.slice(0, 120).replace(/\s+/g,' '));
      if (/correct/i.test(text)) { setParagraphColor(parEl, 'correct'); return; }
      if (/incorrect/i.test(text)) { setParagraphColor(parEl, 'incorrect'); return; }

      console.warn(LOG_PREFIX, 'Could not determine feedback state from MCQ DOM.');
    }

    // === setup and attach ===
    function setup() {
      console.info(LOG_PREFIX, 'setup starting - locating blocks...');
      const mcqBlock = findBlockByDataId(MCQ_BLOCK_ID);
      const parBlock = findBlockByDataId(PAR_BLOCK_ID);

      console.info(LOG_PREFIX, 'mcqBlock:', mcqBlock ? 'FOUND' : 'NOT FOUND', 'parBlock:', parBlock ? 'FOUND' : 'NOT FOUND');

      if (!mcqBlock) {
        console.error(LOG_PREFIX, 'MCQ block not found. Please verify data-block-id="' + MCQ_BLOCK_ID + '" exists in the exported HTML. Stopping.');
        return;
      }
      if (!parBlock) {
        console.error(LOG_PREFIX, 'Paragraph block not found. Please verify data-block-id="' + PAR_BLOCK_ID + '" exists. Stopping.');
        return;
      }

      const parEl = findParagraphTarget(parBlock);
      console.info(LOG_PREFIX, 'paragraph target element:', parEl ? parEl.tagName + (parEl.className ? ' .' + parEl.className.split(' ').join('.') : '') : 'NONE');

      // log quick DOM snapshot for MCQ block
      try {
        console.info(LOG_PREFIX, 'MCQ block outerHTML (first 800 chars):', mcqBlock.outerHTML.slice(0, 800).replace(/\s+/g,' '));
      } catch (e) { /* some nodes may not serialize cleanly */ }

      // find submit button
      const submitBtn = mcqBlock.querySelector('.quiz-card__button, .quiz-card__submit button, button[type="button"].quiz-card__button');
      console.info(LOG_PREFIX, 'Submit button:', submitBtn ? ('FOUND -> ' + submitBtn.textContent.trim()) : 'NOT FOUND');

      if (submitBtn) {
        submitBtn.addEventListener('click', function () {
          console.info(LOG_PREFIX, 'Submit clicked — waiting briefly then evaluating...');
          // short delay then evaluate
          setTimeout(function () { evaluateMCQAndMark(mcqBlock, parEl || parBlock); }, 150);
          // also poll a few times (handles async)
          let tries = 0;
          const poll = setInterval(function () {
            tries++;
            evaluateMCQAndMark(mcqBlock, parEl || parBlock);
            if (tries >= 10) clearInterval(poll);
          }, 250);
        });
      } else {
        console.warn(LOG_PREFIX, 'submit button not found — will observe DOM mutations instead.');
      }

      // MutationObserver: watch feedback container if available
      const feedbackContainer = mcqBlock.querySelector('.quiz-card__feedback, .quiz-card__feedback-wrap, .quiz-card__interactive, [aria-live]');
      if (feedbackContainer) {
        console.info(LOG_PREFIX, 'Attaching MutationObserver to feedbackContainer');
        try {
          const mo = new MutationObserver(function (mutations) {
            console.info(LOG_PREFIX, 'MutationObserver detected changes in feedback container');
            evaluateMCQAndMark(mcqBlock, parEl || parBlock);
          });
          mo.observe(feedbackContainer, { childList: true, subtree: true, characterData: true });
        } catch (e) {
          console.warn(LOG_PREFIX, 'Could not attach MutationObserver to feedbackContainer:', e);
        }
      } else {
        console.info(LOG_PREFIX, 'No dedicated feedback container found; attaching MutationObserver to mcqBlock root');
        try {
          const mo2 = new MutationObserver(function () {
            evaluateMCQAndMark(mcqBlock, parEl || parBlock);
          });
          mo2.observe(mcqBlock, { attributes: true, subtree: true, childList: true, characterData: true });
        } catch (e) {
          console.warn(LOG_PREFIX, 'Could not attach MutationObserver to mcqBlock root:', e);
        }
      }

      // evaluate once on load (handles pre-answered / retake)
      setTimeout(function () { evaluateMCQAndMark(mcqBlock, parEl || parBlock); }, 500);
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }

    // Add optional CSS classes to head so class-based styling is available
    (function addCSS() {
      const css = '.rise-mcq-correct{color:green!important}.rise-mcq-incorrect{color:red!important}';
      const style = document.createElement('style');
      style.type = 'text/css';
      style.appendChild(document.createTextNode(css));
      document.head && document.head.appendChild(style);
      console.info(LOG_PREFIX, 'Added helper CSS classes (.rise-mcq-correct/.rise-mcq-incorrect)');
    })();

  } catch (err) {
    console.error('[Rise-MCQ] Fatal script error:', err && err.stack ? err.stack : err);
  }
})();
</script>
