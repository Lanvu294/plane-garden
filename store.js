/* ============================================================================
   One shared state for the panel and the sky. Both read it; both change it
   only through set(). Nothing else holds a second copy.

     panelOpen    is the question panel showing
     view         'answered' | 'waiting'   the panel's tab
     mode         'browse' | 'ask' | 'sent'
     query        the search text (kept when the panel closes)
     hoveredId    a question id under the pointer, in the panel or the sky
     hoveredPlane the one plane under the pointer (when hovering the sky):
                  a question flies on several planes, but only the one you
                  point at lights up
     hoverSource  'panel' | 'sky' | 'key'
     openId       the question whose plane is unfolded (or unfolding)
     openHint     the plane to use for it, when the sky was clicked
     suggestIds   "others asked something similar" — lifted in the sky
     locateId     a question to find: the sky pans to it and pulses it
     panelRect    where the panel sits on screen, so the reading sheet can
                  centre itself in the space that's left
     visibleIds   the rows the panel is showing, in order (for next/prev)
     dataVersion  bumps when questions change (sent, answered)

   The sky's filter is derived: with the panel closed, or while asking, it
   is 'all' and the query doesn't apply.
   ========================================================================== */
(function () {
  'use strict';
  var state = {
    panelOpen: false, view: 'answered', mode: 'browse', query: '',
    hoveredId: null, hoveredPlane: null, hoverSource: null, openId: null, openHint: null,
    suggestIds: [], locateId: null, panelRect: null, visibleIds: [],
    dataVersion: 0
  };
  var subs = [];

  function same(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    }
    return false;
  }

  window.QF_STORE = {
    get: function () { return state; },
    set: function (patch) {
      var changed = {}, any = false;
      for (var k in patch) if (!same(state[k], patch[k])) { changed[k] = true; any = true; }
      if (!any) return;
      var prev = state;
      state = Object.assign({}, state, patch);
      subs.slice().forEach(function (fn) { fn(state, prev, changed); });
    },
    subscribe: function (fn) {
      subs.push(fn);
      return function () { subs = subs.filter(function (f) { return f !== fn; }); };
    },
    /* what the sky shows */
    skyFilter: function () {
      var browsing = state.panelOpen && state.mode === 'browse';
      return { view: browsing ? state.view : 'all', query: browsing ? state.query : '' };
    }
  };
})();
